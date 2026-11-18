-- Recomendação do Security Advisor do Supabase (lint 0011): fixar search_path da função.
ALTER FUNCTION public.evento_imutavel() SET search_path = '';
