// Regras de data, tiradas do contrato do primeiro cliente
// (Contrato_TheKings_Arkosys.pdf): cl. 4.1 (30 dias corridos contados do pagamento
// da 1ª parcela), cl. 4.2 (suspensão do prazo), cl. 3.2(b) (5 dias úteis após o aceite),
// cl. 7.4 (garantia de 30 dias contados do aceite). Os números são parâmetros
// de cada contrato; nada aqui está fixo no código.
//
// Limitação declarada: "dia útil" = segunda a sexta. Feriados não são considerados;
// o vencimento pode ser editado no painel, com registro de evento.

const DIA_MS = 86_400_000;

export function paraData(iso) {
  if (!iso) return null;
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}
export const paraIso = (data) => (data ? data.toISOString().slice(0, 10) : null);
export const somarDias = (data, dias) => new Date(data.getTime() + dias * DIA_MS);
export const diferencaDias = (a, b) => Math.round((b.getTime() - a.getTime()) / DIA_MS);

export function somarDiasUteis(data, dias) {
  let atual = data;
  let restantes = dias;
  while (restantes > 0) {
    atual = somarDias(atual, 1);
    const dow = atual.getUTCDay();
    if (dow !== 0 && dow !== 6) restantes -= 1;
  }
  return atual;
}

/** Dias corridos suspensos (cl. 4.2). Suspensão aberta conta até `hoje`. Fim = dia em que o prazo volta a correr. */
export function diasSuspensos(suspensoes, hoje) {
  return suspensoes.reduce((total, s) => {
    const inicio = paraData(s.inicio);
    const fim = s.fim ? paraData(s.fim) : hoje;
    return total + Math.max(0, diferencaDias(inicio, fim));
  }, 0);
}

/** Entrega prevista = marco inicial (1º pagamento) + prazo + dias suspensos. Null se o prazo ainda não começou. */
export function entregaPrevista({ dataPrimeiroPagamento, prazoDiasCorridos }, suspensoes, hoje) {
  const inicio = paraData(dataPrimeiroPagamento);
  if (!inicio) return null;
  return somarDias(inicio, prazoDiasCorridos + diasSuspensos(suspensoes, hoje));
}

export function fimGarantia({ dataAceite, diasGarantia }) {
  const aceite = paraData(dataAceite);
  return aceite ? somarDias(aceite, diasGarantia) : null;
}

export function vencimentoParcela({ diasUteisAposGatilho }, dataGatilho) {
  const base = paraData(dataGatilho);
  return base ? somarDiasUteis(base, diasUteisAposGatilho) : null;
}
