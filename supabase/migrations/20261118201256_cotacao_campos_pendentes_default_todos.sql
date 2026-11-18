-- Cotações novas nascem com TODAS as perguntas obrigatórias pendentes.
--
-- Por quê: cotações criadas fora do wizard (assumir lead / Central, RPCs) já
-- abrem o wizard com `?id=`. Com default vazio ("tudo respondido"), os selects
-- obrigatórios (Zero KM, Perfil, Uso, Tipo de seguro/cálculo, Combustível)
-- apareciam pré-preenchidos com o valor padrão. Agora o wizard sempre
-- sobrescreve esta lista no primeiro salvamento; linhas EXISTENTES não mudam
-- (continuam '{}' = tudo respondido). Chaves = `chavesPendentes` (front).
alter table public.cotacoes
  alter column campos_pendentes set default array[
    'zeroKm',
    'perfil:garagem','perfil:proprietario','perfil:condutor',
    'perfil:residencia','perfil:corretor','perfil:jovens',
    'uso:tipoUso','uso:comercial','uso:trabalho','uso:estudo',
    'dados:tipoSeguro','dados:tipoCalculo','dados:combustivel'
  ]::text[];
