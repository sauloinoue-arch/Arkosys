// Número único de WhatsApp da Arkosys (decisão do usuário em 17/11/2026: os três números
// viram um só). O valor vem da variável de ambiente VITE_WHATSAPP_ARKOSYS, só dígitos com
// DDI e DDD. Pendente: o número será informado pelo usuário. Sem ele, os botões ficam ocultos.
const NUMERO = (import.meta.env.VITE_WHATSAPP_ARKOSYS ?? '').replace(/\D/g, '');

export const CONTACT_NUMBERS = NUMERO ? [NUMERO] : [];
export const whatsappConfigurado = () => Boolean(NUMERO);

export const formatPhoneNumber = (phone) => {
  const clean = phone.replace(/\D/g, '');
  if (clean.length !== 13) return `+${clean}`;
  return `(${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
};

/** Link do WhatsApp com a mensagem; null se o número ainda não foi configurado. */
export const createWhatsAppUrl = (message = '') =>
  (NUMERO ? `https://wa.me/${NUMERO}?text=${encodeURIComponent(message)}` : null);
