// Única função Vercel da API. Todas as rotas /api/* chegam aqui pela regra de
// reescrita do vercel.json. Os módulos ficam fora da pasta api/ (em server/),
// conforme https://vercel.com/docs/functions/quickstart (consultado em 17/11/2026).
import { criarApp } from '../server/app.js';
import { obterDb } from '../server/db/cliente.js';
import { resolvedorSupabase } from '../server/core/auth.js';
import { armazenamentoSupabase } from '../server/core/armazenamento.js';

let app;
export default {
  async fetch(request) {
    if (!app) {
      const db = obterDb();
      app = criarApp({ db, resolverConsumidor: resolvedorSupabase(db), armazenamento: armazenamentoSupabase() });
    }
    return app.handle(request);
  },
};
