// Usuários: sessão atual, troca obrigatória de senha, configuração inicial dos sócios,
// ativação/desativação e liberação de acesso do cliente ao portal (R2).
import { z } from 'zod';
import { asc, eq } from 'drizzle-orm';
import { contato, contrato, evento, usuario, usuarioEscopo } from '../db/schema.js';
import { ESCOPOS_PADRAO } from '../core/escopos.js';
import { erros, ErroApi } from '../core/erros.js';
import { validar, UUID_RE } from '../core/validar.js';

// Decisão técnica: mínimo de 12 caracteres para a senha definitiva.
const SENHA_MINIMA = 12;
const esquemaSenha = z.object({ novaSenha: z.string().min(SENHA_MINIMA, `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`).max(128) });

// Sócios iniciais informados pelo usuário em 19/11/2026. Nome = área (os nomes pessoais não foram informados).
const SOCIOS_INICIAIS = [
  { email: 'juridico@arkosys.com.br', area: 'juridico', nome: 'Jurídico' },
  { email: 'desenvolvimento@arkosys.com.br', area: 'desenvolvimento', nome: 'Desenvolvimento' },
  { email: 'ciberseguranca@arkosys.com.br', area: 'ciberseguranca', nome: 'Cibersegurança' },
];

export const rotasUsuarios = [
  {
    metodo: 'GET', caminho: '/api/eu', escopo: null, permiteSenhaProvisoria: true,
    async executar({ consumidor }) {
      const { id, nome, email, tipo, area, escopos, deveTrocarSenha } = consumidor;
      return { id, nome, email, tipo, area, escopos, deveTrocarSenha };
    },
  },
  {
    metodo: 'POST', caminho: '/api/eu/senha', escopo: null, escrita: true, permiteSenhaProvisoria: true,
    operacao: 'trocar_senha',
    async executar({ db, consumidor, dados, autenticacaoAdmin, registrar }) {
      const { novaSenha } = validar(esquemaSenha, dados);
      if (/^(\d)\1+$|^1234567/.test(novaSenha)) throw erros.validacao('Senha fraca demais.', 'novaSenha');
      await autenticacaoAdmin.trocarSenha(consumidor.id, novaSenha);
      await db.update(usuario).set({ deveTrocarSenha: false }).where(eq(usuario.id, consumidor.id));
      // O evento registra QUE a senha mudou, nunca a senha.
      await registrar({ entidade: 'usuario', entidadeId: consumidor.id, acao: 'trocar_senha' });
      return { ok: true };
    },
  },
  {
    // Só funciona enquanto não existir nenhum sócio; depois disso, fica inerte para sempre.
    // É GET de propósito: é acionada uma única vez pelo responsável técnico, abrindo o endereço.
    metodo: 'GET', caminho: '/api/configuracao-inicial', publica: true,
    async executar({ db, autenticacaoAdmin, env }) {
      return db.transaction(async (tx) => {
        const existentes = await tx.select({ id: usuario.id }).from(usuario).where(eq(usuario.tipo, 'socio'));
        if (existentes.length > 0) throw new ErroApi(409, 'ja_configurado', 'A configuração inicial já foi feita.');
        const senha = env.SENHA_INICIAL;
        if (!senha) throw new ErroApi(409, 'senha_inicial_ausente', 'Variável SENHA_INICIAL não configurada.');
        const criados = [];
        for (const s of SOCIOS_INICIAIS) {
          const { id } = await autenticacaoAdmin.criarUsuario(s.email, senha);
          await tx.insert(usuario).values({ id, nome: s.nome, email: s.email, tipo: 'socio', area: s.area, deveTrocarSenha: true });
          await tx.insert(usuarioEscopo).values(ESCOPOS_PADRAO.socio.map((escopo) => ({ usuarioId: id, escopo })));
          await tx.insert(evento).values({ atorTipo: 'sistema', via: 'sistema', entidade: 'usuario', entidadeId: id, acao: 'criar_socio_inicial', depois: { email: s.email, area: s.area } });
          criados.push(s.email);
        }
        return { criados };
      });
    },
  },
  {
    metodo: 'GET', caminho: '/api/usuarios', escopo: 'usuarios:administrar',
    async executar({ db }) {
      const itens = await db.select({
        id: usuario.id, nome: usuario.nome, email: usuario.email, tipo: usuario.tipo, area: usuario.area,
        ativo: usuario.ativo, clienteId: usuario.clienteId, liberadoEm: usuario.liberadoEm, deveTrocarSenha: usuario.deveTrocarSenha,
      }).from(usuario).orderBy(asc(usuario.tipo), asc(usuario.email));
      return { itens };
    },
  },
  {
    metodo: 'POST', caminho: '/api/usuarios/:id/ativo', escopo: 'usuarios:administrar', escrita: true,
    operacao: 'alterar_ativo',
    async executar({ db, params, dados, consumidor, registrar }) {
      const d = validar(z.object({ ativo: z.boolean() }), dados);
      if (!UUID_RE.test(params.id)) throw erros.naoEncontrado('Usuário');
      if (params.id === consumidor.id && !d.ativo) throw erros.conflito('Você não pode desativar o próprio acesso.', 'ativo');
      const [u] = await db.select().from(usuario).where(eq(usuario.id, params.id));
      if (!u) throw erros.naoEncontrado('Usuário');
      const [novo] = await db.update(usuario).set({ ativo: d.ativo }).where(eq(usuario.id, u.id)).returning();
      await registrar({ entidade: 'usuario', entidadeId: u.id, acao: d.ativo ? 'ativar' : 'desativar', antes: { ativo: u.ativo }, depois: { ativo: novo.ativo } });
      return { usuario: { id: novo.id, ativo: novo.ativo } };
    },
  },
  {
    // Acesso do cliente ao portal: só por decisão de um sócio, e só depois do contrato assinado.
    // Gera o link de convite; o sócio envia (o sistema não envia nada ao cliente).
    metodo: 'POST', caminho: '/api/contatos/:id/liberar-acesso', escopo: 'usuarios:administrar', escrita: true,
    operacao: 'liberar_acesso_cliente', statusCriacao: 201,
    async executar({ db, params, consumidor, autenticacaoAdmin, registrar, env }) {
      if (!UUID_RE.test(params.id)) throw erros.naoEncontrado('Contato');
      const [c] = await db.select().from(contato).where(eq(contato.id, params.id));
      if (!c) throw erros.naoEncontrado('Contato');
      if (!c.email) throw erros.validacao('O contato não tem e-mail cadastrado.', 'email');
      const contratos = await db.select({ id: contrato.id }).from(contrato).where(eq(contrato.contatoId, c.id));
      if (contratos.length === 0) throw erros.conflito('O acesso só pode ser liberado depois do contrato assinado.', 'contrato');
      const [existe] = await db.select().from(usuario).where(eq(usuario.email, c.email));
      if (existe) throw erros.conflito('Este e-mail já tem acesso.', 'email');
      const { id, link } = await autenticacaoAdmin.gerarConvite(c.email, `${env.URL_PUBLICA ?? ''}/entrar`);
      await db.insert(usuario).values({
        id, nome: c.nome, email: c.email, tipo: 'cliente', clienteId: c.id, liberadoPor: consumidor.id, liberadoEm: new Date(),
        deveTrocarSenha: true, // o convidado define a própria senha no primeiro acesso
      });
      await db.insert(usuarioEscopo).values(ESCOPOS_PADRAO.cliente.map((escopo) => ({ usuarioId: id, escopo })));
      await registrar({ entidade: 'usuario', entidadeId: id, acao: 'liberar_acesso_cliente', depois: { contatoId: c.id, email: c.email } });
      // O link não entra no registro de eventos nem na resposta guardada para idempotência.
      return { usuarioId: id, linkConvite: link, instrucao: 'Envie este link ao cliente pelo WhatsApp ou e-mail da Arkosys. Ele vale uma vez.', _naoGuardar: ['linkConvite'] };
    },
  },
];
