// R2 — escopos por usuário. Sócio recebe todos; cliente só lê o próprio projeto;
// agente (Fase 3) nasce sem escopos e recebe só o mínimo quando for ativado.
import { erros } from './erros.js';

export const ESCOPOS = Object.freeze([
  'contatos:ler', 'contatos:escrever',
  'oportunidades:ler', 'oportunidades:escrever',
  'contratos:ler', 'contratos:escrever',
  'cobrancas:ler', 'cobrancas:escrever',
  'documentos:ler', 'documentos:escrever',
  'eventos:ler',
  'usuarios:administrar',
  'precos:administrar',
  'portal:ler_proprio',
]);

export const ESCOPOS_PADRAO = Object.freeze({
  socio: ESCOPOS.filter((e) => e !== 'portal:ler_proprio'),
  cliente: ['portal:ler_proprio'],
  agente: [],
});

export function exigirEscopo(consumidor, escopo) {
  if (!consumidor) throw erros.naoAutenticado();
  if (!consumidor.escopos.includes(escopo)) throw erros.escopoInsuficiente(escopo);
}
