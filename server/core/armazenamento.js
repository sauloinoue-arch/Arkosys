// Pasta de documentos por cliente: bucket privado "documentos" no Supabase Storage.
// Métodos conferidos nas definições do pacote @supabase/storage-js instalado
// (createSignedUploadUrl → { signedUrl, token, path }; createSignedUrl(path, expiresIn); download(path)).
// O envio vai do navegador direto ao Storage pelo link assinado, sem passar pela função
// da Vercel (limite de 4,5 MB por requisição).
import { createClient } from '@supabase/supabase-js';

export const BUCKET = 'documentos';
const VALIDADE_DOWNLOAD_S = 60;

export function armazenamentoSupabase(env = process.env) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const bucket = () => supabase.storage.from(BUCKET);
  return {
    async linkEnvio(caminho) {
      const { data, error } = await bucket().createSignedUploadUrl(caminho);
      if (error) throw new Error(`storage: ${error.message}`);
      return { url: data.signedUrl, token: data.token, caminho: data.path };
    },
    async ler(caminho) {
      const { data, error } = await bucket().download(caminho);
      if (error) return null;
      return Buffer.from(await data.arrayBuffer());
    },
    async linkDownload(caminho, nomeArquivo) {
      const { data, error } = await bucket().createSignedUrl(caminho, VALIDADE_DOWNLOAD_S, { download: nomeArquivo });
      if (error) throw new Error(`storage: ${error.message}`);
      return { url: data.signedUrl, validadeSegundos: VALIDADE_DOWNLOAD_S };
    },
  };
}
