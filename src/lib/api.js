// Cliente da API. R1: a tela não decide nada — só envia, recebe e mostra.
// Toda escrita leva a chave de idempotência (R5), a via "painel" (R4) e, quando há
// formulário, o tempo de preenchimento (medição do critério (d) da Fase 3).
import { supabase, tokenAtual } from './sessao.js';

export class ErroDaApi extends Error {
  constructor(status, corpo) {
    super(corpo?.mensagem ?? `Erro ${status}`);
    this.status = status;
    this.codigo = corpo?.codigo;
    this.campo = corpo?.campo;
  }
}

async function requisitar(metodo, caminho, { corpo, chave, duracaoMs, publico = false } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (!publico) {
    const token = await tokenAtual();
    if (token) headers.authorization = `Bearer ${token}`;
    headers['x-via'] = 'painel';
  }
  if (metodo !== 'GET') headers['idempotency-key'] = chave ?? crypto.randomUUID();
  if (duracaoMs) headers['x-duracao-preenchimento-ms'] = String(Math.round(duracaoMs));
  const r = await fetch(caminho, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErroDaApi(r.status, json);
  return json;
}

export const api = {
  get: (caminho, opcoes) => requisitar('GET', caminho, opcoes),
  post: (caminho, corpo, opcoes = {}) => requisitar('POST', caminho, { ...opcoes, corpo }),
};

/** Envio de arquivo em 3 passos (reservar → enviar direto ao Storage → confirmar). */
export async function enviarArquivo({ contatoId, contratoId, tipo, arquivo }) {
  const { documento, envio } = await api.post('/api/documentos', {
    contatoId, contratoId, tipo, nomeArquivo: arquivo.name, tamanhoBytes: arquivo.size,
  });
  // Método oficial do cliente Supabase para link assinado de envio.
  const { error } = await supabase.storage.from('documentos').uploadToSignedUrl(envio.caminho, envio.token, arquivo, { contentType: arquivo.type || 'application/octet-stream' });
  if (error) throw new Error('Falha ao enviar o arquivo ao armazenamento.');
  const confirmado = await api.post(`/api/documentos/${documento.id}/confirmar`, {});
  return confirmado.documento;
}

export const reais = (centavos) => (Number(centavos ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const dataBr = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—');
export const dataHoraBr = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' }) : '—');

/** Marca o início do preenchimento de um formulário. */
export const cronometro = () => { const t = performance.now(); return () => performance.now() - t; };

export const ROTULOS = {
  estado: {
    cadastro_site: 'Cadastro no site', orcamento_gerado: 'Orçamento gerado', contato_recebido: 'Contato recebido',
    reuniao_agendada: 'Reunião agendada', reuniao_realizada: 'Reunião realizada',
    proposta_contrato_enviados: 'Proposta e contrato enviados', contrato_assinado: 'Contrato assinado',
    aguardando_retorno: 'Aguardando retorno', desistiu: 'Desistiu',
  },
  projeto: {
    aguardando_primeiro_pagamento: 'Aguardando 1º pagamento', em_desenvolvimento: 'Em desenvolvimento',
    prazo_suspenso: 'Prazo suspenso', aguardando_aceite: 'Aguardando aceite', entregue: 'Entregue', garantia_encerrada: 'Garantia encerrada',
  },
  origem: {
    site_simulador: 'Site (simulador)', ia_generativa: 'IA generativa (ChatGPT etc.)', instagram: 'Instagram', google_ads: 'Google Ads',
    whatsapp: 'WhatsApp', indicacao: 'Indicação', presencial: 'Presencial', agente: 'Agente',
  },
  parcela: { prevista: 'Prevista', a_receber: 'A receber', paga: 'Paga' },
  documento: {
    proposta: 'Proposta', contrato: 'Contrato', termo_recebimento: 'Termo de recebimento', comprovante: 'Comprovante',
    aditivo: 'Aditivo', evidencia_aceite: 'Evidência de aceite', outro: 'Outro',
  },
  aceite: { expresso: 'Expresso (termo de recebimento)', decurso_prazo: 'Tácito — decurso do prazo de testes', uso_real: 'Tácito — uso em operação real' },
  meio: { pix: 'Pix', cartao_credito: 'Cartão de crédito', transferencia_internacional: 'Transferência internacional' },
};
