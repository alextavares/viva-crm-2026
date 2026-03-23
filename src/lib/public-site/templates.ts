import type { SiteTheme } from "@/lib/site"

export type PublicSiteTemplate = {
  id: SiteTheme
  shortLabel: string
  displayName: string
  adminTitle: string
  adminDescription: string
  marketingDescription: string
  previewClassName: string
}

export const PUBLIC_SITE_TEMPLATES: PublicSiteTemplate[] = [
  {
    id: "search_first",
    shortLabel: "Template 01",
    displayName: "Busca Forte",
    adminTitle: "Busca forte e CTA direto",
    adminDescription:
      "Hero orientado a captacao, leitura rapida dos cards e foco em gerar contato com menos friccao.",
    marketingDescription:
      "Para conversao: busca, cards e formulario sempre visivel.",
    previewClassName:
      "bg-gradient-to-br from-emerald-500/30 via-white/5 to-transparent",
  },
  {
    id: "search_highlights",
    shortLabel: "Template 02",
    displayName: "Busca + Destaques",
    adminTitle: "Busca no topo e vitrine logo abaixo",
    adminDescription:
      "Mantem conversao alta, mas da mais peso para imoveis em destaque e atalhos comerciais.",
    marketingDescription:
      "Equilibrio entre conversao rapida e vitrine de destaque.",
    previewClassName:
      "bg-gradient-to-br from-cyan-500/25 via-white/5 to-transparent",
  },
  {
    id: "premium",
    shortLabel: "Template 03",
    displayName: "Vitrine Editorial",
    adminTitle: "Vitrine mais elegante e consultiva",
    adminDescription:
      "Hero editorial, cards mais amplos e ficha do imovel com apresentacao mais sofisticada.",
    marketingDescription:
      "Mais editorial, fotos grandes e destaque para contexto.",
    previewClassName:
      "bg-gradient-to-br from-amber-500/25 via-white/5 to-transparent",
  },
  {
    id: "trust_first",
    shortLabel: "Template 04",
    displayName: "Institucional Leve",
    adminTitle: "Marca e confianca antes da busca",
    adminDescription:
      "Traz proposta de valor e confianca primeiro, com busca forte logo em seguida.",
    marketingDescription:
      "Institucional primeiro, com busca logo na sequencia.",
    previewClassName:
      "bg-gradient-to-br from-blue-500/25 via-white/5 to-transparent",
  },
  {
    id: "compact_mobile",
    shortLabel: "Template 05",
    displayName: "Compacto Mobile",
    adminTitle: "Leve e objetivo para celular",
    adminDescription:
      "Componentes mais curtos, leitura rapida e foco em navegacao enxuta.",
    marketingDescription:
      "Carrega rapido e prioriza leitura objetiva no mobile.",
    previewClassName:
      "bg-gradient-to-br from-lime-500/25 via-white/5 to-transparent",
  },
]

export function getPublicTemplateById(id: SiteTheme) {
  return PUBLIC_SITE_TEMPLATES.find((template) => template.id === id) ?? PUBLIC_SITE_TEMPLATES[0]
}
