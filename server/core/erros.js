// Formato único de erro da API: { codigo, mensagem, campo }.
export class ErroApi extends Error {
  constructor(status, codigo, mensagem, campo = null) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.campo = campo;
  }
  corpo() {
    return { codigo: this.codigo, mensagem: this.message, campo: this.campo };
  }
}

export const erros = {
  naoAutenticado: () => new ErroApi(401, 'nao_autenticado', 'Sessão ausente ou expirada.'),
  escopoInsuficiente: (escopo) => new ErroApi(403, 'escopo_insuficiente', `Falta o escopo "${escopo}".`),
  naoEncontrado: (entidade) => new ErroApi(404, 'nao_encontrado', `${entidade} não encontrado.`),
  validacao: (mensagem, campo) => new ErroApi(422, 'dados_invalidos', mensagem, campo),
  transicaoInvalida: (de, para) => new ErroApi(409, 'transicao_invalida', `Não é permitido ir de "${de}" para "${para}".`),
  chaveAusente: () => new ErroApi(400, 'chave_idempotencia_ausente', 'Toda escrita exige o cabeçalho Idempotency-Key (uuid).', 'Idempotency-Key'),
  chaveReutilizada: () => new ErroApi(409, 'chave_reutilizada_com_dados_diferentes', 'Esta chave já foi usada com outros dados.', 'Idempotency-Key'),
  documentoObrigatorio: (tipo) => new ErroApi(409, 'documento_obrigatorio_ausente', `Falta anexar o documento "${tipo}".`),
  conflito: (mensagem, campo) => new ErroApi(409, 'conflito', mensagem, campo),
  limite: () => new ErroApi(429, 'limite_de_envios', 'Muitas tentativas. Tente novamente mais tarde.'),
};
