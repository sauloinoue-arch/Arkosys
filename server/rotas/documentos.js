// Documentos (pasta por cliente). Fluxo em 3 passos, para que arquivo e registro
// nunca fiquem desencontrados (Parecer, item 14 — ponto que falha primeiro):
//   1. reservar: cria o registro (confirmado = false) e devolve o link de envio;
//   2. o navegador envia o arquivo direto ao Storage;
//   3. confirmar: a API lê o arquivo, calcula o SHA-256 e marca como confirmado.
// Só documento confirmado pode ser usado como prova (contrato, termo, comprovante).
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { contato, documento } from '../db/schema.js';
import { erros } from '../core/erros.js';
import { validar, UUID_RE } from '../core/validar.js';

const TIPOS = ['proposta', 'contrato', 'termo_recebimento', 'comprovante', 'aditivo', 'evidencia_aceite', 'outro'];
const TAMANHO_MAXIMO = 20 * 1024 * 1024; // decisão técnica: 20 MB por arquivo, cabe em PDF de contrato assinado

const esquemaReserva = z.object({
  contatoId: z.string().regex(UUID_RE),
  contratoId: z.string().regex(UUID_RE).optional(),
  tipo: z.enum(TIPOS),
  nomeArquivo: z.string().trim().min(1).max(200),
  tamanhoBytes: z.number().int().positive().max(TAMANHO_MAXIMO),
});

const nomeSeguro = (n) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(0, 120);

/** Usado por outras rotas: exige documento confirmado, do tipo e do contato certos. */
export async function exigirDocumento(db, { id, tipos, contatoId }) {
  if (!id || !UUID_RE.test(id)) throw erros.documentoObrigatorio(tipos.join(' ou '));
  const [d] = await db.select().from(documento).where(and(eq(documento.id, id), isNull(documento.excluidoEm)));
  if (!d || !d.confirmado || !tipos.includes(d.tipo) || d.contatoId !== contatoId) {
    throw erros.documentoObrigatorio(tipos.join(' ou '));
  }
  return d;
}

export const rotasDocumentos = [
  {
    metodo: 'POST', caminho: '/api/documentos', escopo: 'documentos:escrever', escrita: true,
    operacao: 'reservar_documento', statusCriacao: 201,
    async executar({ db, dados, consumidor, armazenamento, registrar }) {
      const d = validar(esquemaReserva, dados);
      const [c] = await db.select({ id: contato.id }).from(contato).where(eq(contato.id, d.contatoId));
      if (!c) throw erros.naoEncontrado('Contato');
      const id = randomUUID();
      const caminho = `clientes/${d.contatoId}/${id}-${nomeSeguro(d.nomeArquivo)}`;
      const [novo] = await db.insert(documento).values({
        id, contatoId: d.contatoId, contratoId: d.contratoId ?? null, tipo: d.tipo,
        nomeArquivo: d.nomeArquivo, caminho, tamanhoBytes: d.tamanhoBytes, enviadoPor: consumidor.id,
      }).returning();
      const envio = await armazenamento.linkEnvio(caminho);
      await registrar({ entidade: 'documento', entidadeId: id, acao: 'reservar', depois: novo });
      return { documento: novo, envio };
    },
  },
  {
    metodo: 'POST', caminho: '/api/documentos/:id/confirmar', escopo: 'documentos:escrever', escrita: true,
    operacao: 'confirmar_documento',
    async executar({ db, params, armazenamento, registrar }) {
      if (!UUID_RE.test(params.id)) throw erros.naoEncontrado('Documento');
      const [d] = await db.select().from(documento).where(eq(documento.id, params.id)).for('update');
      if (!d || d.excluidoEm) throw erros.naoEncontrado('Documento');
      if (d.confirmado) return { documento: d };
      const conteudo = await armazenamento.ler(d.caminho);
      if (!conteudo) throw erros.conflito('O arquivo ainda não chegou ao armazenamento. Envie e tente de novo.', 'arquivo');
      const hash = createHash('sha256').update(conteudo).digest('hex');
      const [ok] = await db.update(documento)
        .set({ confirmado: true, hashSha256: hash, tamanhoBytes: conteudo.length })
        .where(eq(documento.id, d.id)).returning();
      await registrar({ entidade: 'documento', entidadeId: d.id, acao: 'confirmar', antes: d, depois: ok });
      return { documento: ok };
    },
  },
  {
    metodo: 'POST', caminho: '/api/documentos/:id/excluir', escopo: 'documentos:escrever', escrita: true,
    operacao: 'excluir_documento',
    // Exclusão lógica com confirmação explícita no corpo (Restrição 10: nada se apaga sem decisão humana).
    async executar({ db, params, dados, registrar }) {
      if (!dados || dados.confirmar !== true) throw erros.validacao('Confirme a exclusão com "confirmar": true.', 'confirmar');
      if (!UUID_RE.test(params.id)) throw erros.naoEncontrado('Documento');
      const [d] = await db.select().from(documento).where(eq(documento.id, params.id));
      if (!d || d.excluidoEm) throw erros.naoEncontrado('Documento');
      const [ex] = await db.update(documento).set({ excluidoEm: new Date() }).where(eq(documento.id, d.id)).returning();
      await registrar({ entidade: 'documento', entidadeId: d.id, acao: 'excluir', antes: d, depois: ex });
      return { documento: ex };
    },
  },
  {
    metodo: 'GET', caminho: '/api/contatos/:id/documentos', escopo: 'documentos:ler',
    async executar({ db, params }) {
      if (!UUID_RE.test(params.id)) throw erros.naoEncontrado('Contato');
      const itens = await db.select().from(documento)
        .where(and(eq(documento.contatoId, params.id), isNull(documento.excluidoEm)));
      return { itens };
    },
  },
  {
    metodo: 'GET', caminho: '/api/documentos/:id/download', escopo: 'documentos:ler',
    async executar({ db, params, armazenamento }) {
      if (!UUID_RE.test(params.id)) throw erros.naoEncontrado('Documento');
      const [d] = await db.select().from(documento).where(eq(documento.id, params.id));
      if (!d || d.excluidoEm || !d.confirmado) throw erros.naoEncontrado('Documento');
      return armazenamento.linkDownload(d.caminho, d.nomeArquivo);
    },
  },
];
