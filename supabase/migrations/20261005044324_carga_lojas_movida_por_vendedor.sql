-- Carga das lojas Movida por vendedor (carteiras SPI1, SP1, SPI2, SP3, SP4).
--
-- * Lojas já existentes (seed da Captação Movida) são reaproveitadas; as demais
--   são criadas na empresa Matriz.
-- * O vendedor de cada carteira é localizado pelo nome entre os vendedores
--   aprovados da Matriz. Se não houver exatamente um, as lojas ficam sem
--   vendedor (e inativas, pois loja ativa sem pool não distribui lead).
-- * Idempotente: pode rodar de novo sem duplicar lojas, aliases ou pool.

do $$
declare
  _empresa_id uuid;
  _grupo      record;
  _loja       record;
  _vend_id    uuid;
  _qtd        integer;
  _loja_id    uuid;
  _fold       constant text := 'áàâãäéèêëíìîïóòôõöúùûüçñ';
  _plain      constant text := 'aaaaaeeeeiiiiooooouuuucn';
begin
  select count(*) into _qtd from public.empresas where tipo = 'matriz';
  if _qtd <> 1 then
    raise notice 'Carga lojas Movida ignorada: esperada 1 empresa Matriz, encontradas %', _qtd;
    return;
  end if;
  select id into _empresa_id from public.empresas where tipo = 'matriz';

  for _grupo in
    select * from (values
      ('Everton',     array[
        'Campinas Amoreiras','Campinas Itapura','Campinas Orosimbo',
        'Campinas Shop Dom Pedro','Jundiaí','Indaiatuba','Sorocaba',
        'Sorocaba Dom Aguirre','Vila Guilherme','Arena Motors','Santana',
        'São Paulo Radial Leste']),
      ('Wesley',      array[
        'São José dos Campos','Taubaté','Auto Shopping Taubaté',
        'Timóteo Penteado','Itaim Paulista','Vila Carrão',
        'São Miguel Paulista','Penha','Aricanduva','Vila Ema',
        'Miguel Estefano','CS Vila Ema']),
      ('Katia',       array[
        'Americana','Bauru','Limeira','Piracicaba','Ribeirão Preto',
        'Rio Claro','São Carlos','São José do Rio Preto']),
      ('Ana Beatriz', array[
        'Praia Grande','Santos','Mogi das Cruzes','Suzano',
        'Auto Shopping Bandeirantes','Santo André','São Bernardo do Campo',
        'São Bernardo Pereira Barreto']),
      ('André',       array[
        'Auto Shopping Autonomistas','Auto Shopping Raposo',
        'Auto Shopping Tamboré','Osasco','Eliseu de Almeida',
        'Ermano Marchetti','Gastão Vidigal','Nações Unidas']),
      -- Sem vendedor definido: entra só a loja (inativa), como as demais sem pool.
      ('', array['Loja Web'])
    ) as g(vendedor, lojas)
  loop
    -- Vendedor aprovado da Matriz cujo nome começa pelo informado (sem acento).
    select count(*), min(p.id::text)::uuid
      into _qtd, _vend_id
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id and ur.role = 'vendedor'
     where _grupo.vendedor <> ''
       and p.empresa_id = _empresa_id
       and p.status = 'aprovada'
       and p.desligado_em is null
       and translate(lower(p.nome), _fold, _plain) like translate(lower(_grupo.vendedor), _fold, _plain) || '%';

    if _grupo.vendedor = '' then
      _vend_id := null;
    elsif _qtd <> 1 then
      _vend_id := null;
      raise notice 'Vendedor "%": % correspondência(s); lojas ficam sem vendedor', _grupo.vendedor, _qtd;
    end if;

    for _loja in select unnest(_grupo.lojas) as nome
    loop
      select id into _loja_id
        from public.movida_lojas
       where trim(nome) = _loja.nome and empresa_id = _empresa_id
       order by criado_em
       limit 1;

      if _loja_id is null then
        insert into public.movida_lojas (nome, empresa_id, ativa, exigir_online)
        values (_loja.nome, _empresa_id, _vend_id is not null, false)
        returning id into _loja_id;
      elsif _vend_id is not null then
        update public.movida_lojas
           set ativa = true, atualizado_em = now()
         where id = _loja_id and not ativa;
      end if;

      -- Alias com o nome da carga (grafia "Orozimbo", "Shopping Dom Pedro"...).
      insert into public.movida_loja_aliases (loja_id, alias)
      values (_loja_id, _loja.nome)
      on conflict (alias_normalizado) do nothing;

      if _vend_id is not null then
        insert into public.movida_loja_vendedores (loja_id, vendedor_id)
        values (_loja_id, _vend_id)
        on conflict (loja_id, vendedor_id) do update set ativo = true;
      end if;
    end loop;
  end loop;

  -- Grafias da planilha que diferem do nome já cadastrado.
  insert into public.movida_loja_aliases (loja_id, alias)
  select l.id, a.alias
    from (values
      ('Campinas Orosimbo',       'Campinas Orozimbo'),
      ('Campinas Shop Dom Pedro', 'Campinas Shopping Dom Pedro'),
      ('Timóteo Penteado',        'Guarulhos Timóteo Penteado')
    ) as a(loja_nome, alias)
    join public.movida_lojas l on trim(l.nome) = a.loja_nome and l.empresa_id = _empresa_id
  on conflict (alias_normalizado) do nothing;
end $$;
