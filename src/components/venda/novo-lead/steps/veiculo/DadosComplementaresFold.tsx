// Fold "Dados complementares" do Passo 3 — chassi remarcado, isenção de
// imposto, PcD/CNH especial e antifurto (com os sub-campos por seguradora
// que a Quiver aceita quando o antifurto exige — ver
// doc/EXTERNAL_API_GUIDE.md, seção veiculo, campos antifurto*/bloqueador*/
// rastreador*/alarmeSonoro*/dispositivosComuns*).
import { useState } from "react";
import {
  ANTIFURTO_TIPOS,
  ISENCAO_IMPOSTO,
  CATEGORIA_TAXI,
  LEILAO,
} from "@/components/venda/novo-lead/enumsQuiver";
import { maskBRL } from "@/components/venda/novo-lead/masks";
import type { Form } from "@/components/venda/novo-lead/types";

type Props = {
  f: Form;
  up: <K extends keyof Form>(k: K, v: Form[K]) => void;
};

export function DadosComplementaresFold({ f, up }: Props) {
  const [open, setOpen] = useState(false);

  function updDetalhe(key: string, value: string) {
    up("antifurtoDetalhes", { ...f.antifurtoDetalhes, [key]: value });
  }
  const det = (key: string) => f.antifurtoDetalhes[key] ?? "";

  return (
    <div className={`fold${open ? " open" : ""}`}>
      <div className="fold-h" onClick={() => setOpen((v) => !v)}>
        Dados complementares
        <svg className="chev" width="14" height="14">
          <use href="#i-chevron-down" />
        </svg>
      </div>
      <div className="fold-b">
        <div className="wizard-grid">
          <div className="field-group">
            <label>Chassi remarcado</label>
            <select
              className="input"
              value={f.chassiRemarcado}
              onChange={(e) => up("chassiRemarcado", e.target.value as "sim" | "nao")}
            >
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </select>
          </div>
          <div className="field-group">
            <label>Isenção de imposto</label>
            <select
              className="input"
              value={f.isencaoImposto}
              onChange={(e) => up("isencaoImposto", e.target.value)}
            >
              {ISENCAO_IMPOSTO.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label>PcD / CNH especial</label>
            <select
              className="input"
              value={f.pcdCnhEspecial}
              onChange={(e) => up("pcdCnhEspecial", e.target.value as "sim" | "nao")}
            >
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </select>
          </div>
          {f.pcdCnhEspecial === "sim" && (
            <div className="field-group">
              <label>Valor da adaptação PcD</label>
              <input
                className="input"
                value={f.valorAdaptacaoPcd}
                onChange={(e) => up("valorAdaptacaoPcd", maskBRL(e.target.value))}
                placeholder="R$ 0,00"
              />
            </div>
          )}
          <div className="field-group">
            <label>Antifurto</label>
            <select
              className="input"
              value={f.antifurto}
              onChange={(e) => up("antifurto", e.target.value)}
            >
              {ANTIFURTO_TIPOS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label>Histórico de leilão</label>
            <select
              className="input"
              value={f.leilao}
              onChange={(e) => up("leilao", e.target.value)}
            >
              {LEILAO.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field-group full">
            <label>Qual a categoria do Táxi/Veículo?</label>
            <select
              className="input"
              value={f.categoriaTaxi}
              onChange={(e) => up("categoriaTaxi", e.target.value)}
            >
              <option value="">Selecione</option>
              {CATEGORIA_TAXI.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          {f.antifurto !== "Não" && (
            <>
              <div className="field-group">
                <label>Antifurto da Porto Seguro?</label>
                <select
                  className="input"
                  value={f.possuiAntifurtoPorto}
                  onChange={(e) => up("possuiAntifurtoPorto", e.target.value as "sim" | "nao")}
                >
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>
              <div className="field-group">
                <label>HDI Seguros — básico</label>
                <select
                  className="input"
                  value={f.hdiSegurosBasico}
                  onChange={(e) => up("hdiSegurosBasico", e.target.value as "sim" | "nao")}
                >
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>
            </>
          )}

          {f.antifurto === "Alarme Sonoro" && (
            <>
              <div className="field-group">
                <label>Alarme sonoro — Allianz</label>
                <input
                  className="input"
                  value={det("alarmeSonoroAllianz")}
                  onChange={(e) => updDetalhe("alarmeSonoroAllianz", e.target.value)}
                  placeholder="ex.: Corta Combustível - RF-ST2001"
                />
              </div>
              <div className="field-group">
                <label>Alarme sonoro — Bradesco</label>
                <input
                  className="input"
                  value={det("alarmeSonoroAntiFurtoBradesco")}
                  onChange={(e) => updDetalhe("alarmeSonoroAntiFurtoBradesco", e.target.value)}
                  placeholder="ex.: Cielocel GSM/GPRS Gs8"
                />
              </div>
            </>
          )}

          {f.antifurto === "Bloqueador" && (
            <>
              <div className="field-group">
                <label>Bloqueador — Allianz</label>
                <input
                  className="input"
                  value={det("bloqueadorAllianz")}
                  onChange={(e) => updDetalhe("bloqueadorAllianz", e.target.value)}
                />
              </div>
              <div className="field-group">
                <label>Bloqueador — Bradesco Seguros</label>
                <input
                  className="input"
                  value={det("bloqueadorBradescoSeguros")}
                  onChange={(e) => updDetalhe("bloqueadorBradescoSeguros", e.target.value)}
                />
              </div>
              <div className="field-group">
                <label>Bloqueador — Yelum</label>
                <input
                  className="input"
                  value={det("bloqueadorYelum")}
                  onChange={(e) => updDetalhe("bloqueadorYelum", e.target.value)}
                />
              </div>
              <div className="field-group">
                <label>Bloqueador — Porto Seguro</label>
                <input
                  className="input"
                  value={det("bloqueadorPorto")}
                  onChange={(e) => updDetalhe("bloqueadorPorto", e.target.value)}
                />
              </div>
              <div className="field-group">
                <label>Antifurto — Mapfre</label>
                <input
                  className="input"
                  value={det("antifurtoMapfre")}
                  onChange={(e) => updDetalhe("antifurtoMapfre", e.target.value)}
                  placeholder="ex.: CAR SYSTEM - Bloqueador"
                />
              </div>
            </>
          )}

          {f.antifurto === "Rastreador" && (
            <>
              <div className="field-group">
                <label>Rastreador — Allianz</label>
                <input
                  className="input"
                  value={det("rastreadorAllianz")}
                  onChange={(e) => updDetalhe("rastreadorAllianz", e.target.value)}
                />
              </div>
              <div className="field-group">
                <label>Rastreador — Bradesco Seguros</label>
                <input
                  className="input"
                  value={det("rastreadorBradescoSeguros")}
                  onChange={(e) => updDetalhe("rastreadorBradescoSeguros", e.target.value)}
                />
              </div>
              <div className="field-group">
                <label>Rastreador — Yelum</label>
                <input
                  className="input"
                  value={det("rastreadorYelum")}
                  onChange={(e) => updDetalhe("rastreadorYelum", e.target.value)}
                />
              </div>
              <div className="field-group">
                <label>Rastreador — Mapfre</label>
                <input
                  className="input"
                  value={det("rastreadorMapfre")}
                  onChange={(e) => updDetalhe("rastreadorMapfre", e.target.value)}
                />
              </div>
              <div className="field-group">
                <label>Rastreador — Porto Seguro</label>
                <input
                  className="input"
                  value={det("bloqueadorPorto")}
                  onChange={(e) => updDetalhe("bloqueadorPorto", e.target.value)}
                />
              </div>
            </>
          )}

          {f.antifurto === "Dispositivos comuns" && (
            <>
              <div className="field-group">
                <label>
                  Dispositivos comuns — Allianz<span className="req">*</span>
                </label>
                <input
                  className="input"
                  value={det("dispositivosComunsAllianz")}
                  onChange={(e) => updDetalhe("dispositivosComunsAllianz", e.target.value)}
                />
              </div>
              <div className="field-group">
                <label>Alarme sonoro — Bradesco</label>
                <input
                  className="input"
                  value={det("alarmeSonoroAntiFurtoBradesco")}
                  onChange={(e) => updDetalhe("alarmeSonoroAntiFurtoBradesco", e.target.value)}
                />
              </div>
            </>
          )}

          {f.antifurto !== "Não" && (
            <>
              <div className="field-group">
                <label>Antifurto/rastreador — Tokio Marine</label>
                <input
                  className="input"
                  value={det("antifurtoTokio")}
                  onChange={(e) => updDetalhe("antifurtoTokio", e.target.value)}
                  placeholder="ex.: CONTROLLOC GPS"
                />
              </div>
              <div className="field-group">
                <label>Gerenciadora — Tokio Marine</label>
                <input
                  className="input"
                  value={det("gerenciadoraTokio")}
                  onChange={(e) => updDetalhe("gerenciadoraTokio", e.target.value)}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
