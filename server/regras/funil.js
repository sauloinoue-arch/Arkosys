// Estados e transições do funil comercial.
// Origem: descrição do processo pelo usuário em 17/11/2026 e acréscimos da etapa 5
// (cadastro no site → orçamento gerado). Na Fase 1, toda transição é feita por pessoa.

export const ESTADOS_ENTRADA = Object.freeze({
  site: 'cadastro_site',          // pelo site/simulador
  outros: 'contato_recebido',     // pelos demais canais, lançado à mão
});

const SEQUENCIA = {
  cadastro_site: ['orcamento_gerado'],
  orcamento_gerado: ['reuniao_agendada'],
  contato_recebido: ['reuniao_agendada'],
  reuniao_agendada: ['reuniao_realizada'],
  reuniao_realizada: ['proposta_contrato_enviados'],
  proposta_contrato_enviados: ['contrato_assinado'],
  contrato_assinado: [],
  aguardando_retorno: [],         // retorno tratado à parte: volta ao estado anterior
  desistiu: [],                   // encerrado
};

const ABERTOS = new Set(Object.keys(SEQUENCIA).filter((e) => !['contrato_assinado', 'aguardando_retorno', 'desistiu'].includes(e)));

/**
 * Diz se a transição é permitida.
 * - Sequência normal: só para o próximo estado.
 * - Qualquer estado aberto pode ir para 'aguardando_retorno' ou 'desistiu'.
 * - 'aguardando_retorno' só pode voltar ao estado anterior ou ir para 'desistiu'.
 */
export function transicaoPermitida({ de, para, estadoAnterior }) {
  if (de === para) return false;
  if (ABERTOS.has(de) && (para === 'aguardando_retorno' || para === 'desistiu')) return true;
  if (de === 'aguardando_retorno') return para === 'desistiu' || (estadoAnterior && para === estadoAnterior);
  return (SEQUENCIA[de] ?? []).includes(para);
}

// Transições que a mudança simples de estado aceita (as outras são feitas por rotas próprias:
// 'orcamento_gerado' pelo simulador, 'contrato_assinado' pelo registro do contrato).
const MANUAIS = ['reuniao_agendada', 'reuniao_realizada', 'proposta_contrato_enviados', 'aguardando_retorno', 'desistiu', 'cadastro_site', 'contato_recebido'];

/** Lista calculada na API para a tela só exibir os botões válidos (R1). */
export function proximosEstados(op) {
  return MANUAIS.filter((para) => transicaoPermitida({ de: op.estado, para, estadoAnterior: op.estadoAnterior }));
}
