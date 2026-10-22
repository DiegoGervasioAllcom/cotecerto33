# Comissão extra mínima aceita pelo portal Quiver, por seguradora

Medido em 21/10/2026 no portal real (produção), só cotação/cálculo, robô local (master 648a121, imagem reconstruída), fixture `data/test-todas-seguradoras.json`, uma seguradora por cotação. Critério: recusa = log "Portal recusou a comissão ... Restaurando"; aceita = ausência dessa linha.

| Seguradora | Mínimo aceito | Maior recusado | Cotações usadas                      | Observações                                           |
| ---------- | ------------- | -------------- | ------------------------------------ | ----------------------------------------------------- |
| aliro      | 15            | 14             | 6 (20,10,15,12,13,14)                | 20 aceito                                             |
| allianz    | 15            | 14             | 6                                    | idem                                                  |
| bradesco   | 15            | 14             | 6                                    | idem                                                  |
| hdi        | 15            | 14             | 6                                    | idem                                                  |
| mapfre     | 15            | 14             | 4 (12 e 20 já conhecidos + 16,14,15) | 12 recusa, 20 aceita                                  |
| suhai      | 15            | 14             | 6                                    | idem                                                  |
| tokio      | 15            | 14             | 1 (14) + 13 e 15 já conhecidos       | idem                                                  |
| yelum      | 15            | 14             | 6                                    | idem                                                  |
| porto      | n/a           | n/a            | 2 (20, 10)                           | sem comissão editável no portal; robô mantém o padrão |
| azul       | n/a           | n/a            | 1 (20)                               | sem comissão editável no portal; robô mantém o padrão |

Observações:

- Todas as seguradoras com comissão editável têm o mesmo piso: 15 (inteiros). Valores abaixo de 15 são recusados; o robô restaura o original (ex.: Mapfre 25).
- O piso do portal (15) fica acima do piso da faixa aceita pelo banco (10–30, `cot_seg_ajustes_comissao_faixa`): valores de 10 a 14 passam no sistema, mas o portal os recusa e o robô restaura a comissão original.
- O aviso "menor que o permitido" só aparece no Calcular; o log "Comissão ... preenchida" aparece mesmo quando depois é recusada. Por isso o critério é a linha "Portal recusou".
- Decimais (entre 14 e 15) não foram testados.
- O robô só aceita um worker por vez (sessão única do Suppercerto, fila em `workerQueue.ts`), por isso a medição foi sequencial.
- Incidente: o Mac entrou em suspensão e várias cotações travaram em "processando"; resultados inválidos foram descartados e refeitos com `caffeinate`.
