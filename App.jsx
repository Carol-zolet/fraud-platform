import { useState } from "react";

const steps = [
  {
    id: 1,
    icon: "💳",
    title: "Cliente faz uma compra",
    subtitle: null,
    color: "#6366f1",
    details: ["Transação gerada", "Dados: valor, local, horário, cartão"],
    type: "start",
  },
  {
    id: 2,
    icon: "🚪",
    title: "API Gateway",
    subtitle: "NestJS — porta 3000",
    color: "#8b5cf6",
    details: ["Recebe a transação", "Valida o JWT (RS256)", "Verifica permissões (RBAC)", "Rate limiting"],
    type: "service",
    db: null,
  },
  {
    id: 3,
    icon: "🔐",
    title: "Auth Service",
    subtitle: "NestJS — porta 3001",
    color: "#7c3aed",
    details: ["Valida usuário/senha", "Assina JWT com chave privada RSA", "Retorna token ao cliente"],
    type: "service",
    side: true,
    sideLabel: "Só chamado no login",
  },
  {
    id: 4,
    icon: "📨",
    title: "Kafka",
    subtitle: "tópico: transactions.raw",
    color: "#f59e0b",
    details: ['"Correio" entre serviços', "Não perde mensagens", "Processa em ordem", "Replay disponível"],
    type: "queue",
  },
  {
    id: 5,
    icon: "⚙️",
    title: "Feature Service",
    subtitle: "Python",
    color: "#10b981",
    details: ["Calcula variáveis em tempo real", "Média de gastos últimos 10min", "Distância da última compra", "Busca histórico no Redis"],
    type: "service",
    db: "Redis",
    dbIcon: "⚡",
  },
  {
    id: 6,
    icon: "🤖",
    title: "ML Serving",
    subtitle: "FastAPI",
    color: "#3b82f6",
    details: ["Carrega modelo XGBoost", "Predição: fraude ou não", "Score de 0.0 a 1.0", "Explica decisão com SHAP"],
    type: "service",
    db: "MLflow",
    dbIcon: "📊",
  },
  {
    id: 7,
    icon: "📋",
    title: "Audit Service",
    subtitle: "NestJS",
    color: "#ef4444",
    details: ["Salva no PostgreSQL (imutável!)", "Salva log no MongoDB", "Se fraude → dispara alerta", "Ninguém pode apagar o registro"],
    type: "service",
    db: "PostgreSQL + MongoDB",
    dbIcon: "🗄️",
  },
  {
    id: 8,
    icon: "🔔",
    title: "Analista Notificado",
    subtitle: "Resultado final",
    color: "#6366f1",
    details: ["Alerta em tempo real", "Dashboard no Grafana", "Relatório de compliance LGPD"],
    type: "end",
  },
];

export default function App() {
  const [active, setActive] = useState(null);

  return (
    <div style={{ background: "#0f0f1a", minHeight: "100vh", padding: "32px 16px", fontFamily: "monospace" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <h1 style={{ color: "#fff", textAlign: "center", fontSize: 20, marginBottom: 8, letterSpacing: 2 }}>
          🏗️ PLATAFORMA DE DETECÇÃO DE FRAUDES
        </h1>
        <p style={{ color: "#6b7280", textAlign: "center", fontSize: 12, marginBottom: 32 }}>
          Clique em cada bloco para ver os detalhes
        </p>

        {steps.map((step, i) => (
          <div key={step.id}>
            {/* Node */}
            <div style={{ display: "flex", alignItems: "stretch", gap: 12 }}>
              {/* Line + dot */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 40, flexShrink: 0 }}>
                {i > 0 && <div style={{ width: 2, flex: "0 0 16px", background: "#374151" }} />}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: active === step.id ? step.color : "#1f2937",
                    border: `2px solid ${step.color}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: active === step.id ? `0 0 16px ${step.color}66` : "none",
                    flexShrink: 0,
                  }}
                  onClick={() => setActive(active === step.id ? null : step.id)}
                >
                  {step.icon}
                </div>
                {i < steps.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 16, background: "#374151" }} />}
              </div>

              {/* Card */}
              <div
                style={{
                  flex: 1,
                  marginBottom: 4,
                  marginTop: i > 0 ? 16 : 0,
                  background: active === step.id ? "#1a1a2e" : "#111827",
                  border: `1px solid ${active === step.id ? step.color : "#1f2937"}`,
                  borderRadius: 12,
                  padding: "12px 16px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: active === step.id ? `0 0 20px ${step.color}22` : "none",
                }}
                onClick={() => setActive(active === step.id ? null : step.id)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ color: "#fff", fontWeight: "bold", fontSize: 14 }}>{step.title}</div>
                    {step.subtitle && (
                      <div style={{ color: step.color, fontSize: 11, marginTop: 2 }}>{step.subtitle}</div>
                    )}
                  </div>
                  {step.db && (
                    <div
                      style={{
                        background: "#1f2937",
                        border: `1px solid ${step.color}44`,
                        borderRadius: 8,
                        padding: "4px 8px",
                        fontSize: 10,
                        color: "#9ca3af",
                      }}
                    >
                      {step.dbIcon} {step.db}
                    </div>
                  )}
                </div>

                {/* Details */}
                {active === step.id && (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${step.color}33`, paddingTop: 10 }}>
                    {step.details.map((d, j) => (
                      <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                        <span style={{ color: step.color, fontSize: 10, marginTop: 3 }}>▶</span>
                        <span style={{ color: "#d1d5db", fontSize: 12 }}>{d}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Legend */}
        <div style={{ marginTop: 32, background: "#111827", borderRadius: 12, padding: 16, border: "1px solid #1f2937" }}>
          <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 8 }}>INFRAESTRUTURA DE SUPORTE</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { icon: "📈", name: "Prometheus", desc: "Coleta métricas" },
              { icon: "📊", name: "Grafana", desc: "Dashboard visual" },
              { icon: "🔍", name: "Kafka UI", desc: "Monitora mensagens" },
              { icon: "🧪", name: "MLflow", desc: "Versiona modelos" },
            ].map((item) => (
              <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <div>
                  <div style={{ color: "#fff", fontSize: 11 }}>{item.name}</div>
                  <div style={{ color: "#6b7280", fontSize: 10 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
