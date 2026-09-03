import {
  getPublicCurationPreview,
  getPublicCurationSnapshot,
  getPublicSiteReleaseReadiness,
  type PublicCurationReason,
} from "@/lib/public-site/public-curation"

export type PropertyVitrineStatus =
  | "off_market"
  | "blocked_visible"
  | "blocked_hidden"
  | "ready_hidden"
  | "live"

export type PropertyVitrineInput = Parameters<typeof getPublicCurationSnapshot>[0]

export type PropertyVitrineState = {
  status: PropertyVitrineStatus
  label: string
  shortLabel: string
  helper: string
  className: string
  summaryClassName: string
  visibleOnPublicSite: boolean
  canOpenPublicLink: boolean
  readyToRelease: boolean
  blockedByCuration: boolean
  hiddenFromVitrine: boolean
  firstActionIssue: PublicCurationReason | null
  reasonLabels: PublicCurationReason[]
}

export function getPropertyVitrineStatus(property: PropertyVitrineInput): PropertyVitrineState {
  const snapshot = getPublicCurationSnapshot(property)
  const readiness = getPublicSiteReleaseReadiness(property, snapshot)
  const preview = getPublicCurationPreview(snapshot)
  const firstActionIssue = snapshot.blockingReasons[0] ?? snapshot.warningReasons[0] ?? null
  const reasonLabels = preview.visibleReasons

  if (!readiness.commerciallyAvailable) {
    return {
      status: "off_market",
      label: "Fora da publicação pelo status comercial",
      shortLabel: "Fora da publicação",
      helper: "Somente imóveis disponíveis entram no fluxo de site e portais.",
      className: "border-slate-200 bg-slate-50 text-slate-700",
      summaryClassName: "text-slate-700",
      visibleOnPublicSite: false,
      canOpenPublicLink: false,
      readyToRelease: false,
      blockedByCuration: false,
      hiddenFromVitrine: snapshot.hiddenFromVitrine,
      firstActionIssue,
      reasonLabels,
    }
  }

  if (readiness.liveOnPublicSite) {
    return {
      status: "live",
      label: "Publicado no site",
      shortLabel: "Publicado no site",
      helper: "Curadoria aprovada e exibição no site ativa para o comprador.",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      summaryClassName: "text-emerald-700",
      visibleOnPublicSite: true,
      canOpenPublicLink: true,
      readyToRelease: false,
      blockedByCuration: false,
      hiddenFromVitrine: false,
      firstActionIssue,
      reasonLabels,
    }
  }

  if (readiness.readyToRelease) {
    return {
      status: "ready_hidden",
      label: "Pronto para publicar",
      shortLabel: "Pronto para publicar",
      helper: "Disponível, sem pendências críticas e ainda oculto do site.",
      className: "border-sky-200 bg-sky-50 text-sky-800",
      summaryClassName: "text-sky-800",
      visibleOnPublicSite: false,
      canOpenPublicLink: false,
      readyToRelease: true,
      blockedByCuration: false,
      hiddenFromVitrine: true,
      firstActionIssue,
      reasonLabels,
    }
  }

  const hidden = snapshot.hiddenFromVitrine

  return {
    status: hidden ? "blocked_hidden" : "blocked_visible",
    label: "Com pendências",
    shortLabel: hidden ? "Oculto com pendências" : "Publicado com pendências",
    helper: hidden
      ? "O imóvel segue oculto porque ainda há pendências antes da publicação."
      : "A exibição no site está ligada, mas a curadoria ainda impede a publicação.",
    className: hidden
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-red-200 bg-red-50 text-red-700",
    summaryClassName: hidden ? "text-amber-800" : "text-red-700",
    visibleOnPublicSite: false,
    canOpenPublicLink: false,
    readyToRelease: false,
    blockedByCuration: true,
    hiddenFromVitrine: hidden,
    firstActionIssue,
    reasonLabels,
  }
}
