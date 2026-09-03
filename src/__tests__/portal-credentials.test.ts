import {
  canProvisionPortalCredentials,
  isPortalIntegrationActive,
  portalCredentialProvider,
  rotatePortalCredentials,
  stripSecretConfigKeys,
  toCanonicalPortalStatus,
} from "@/lib/integrations/portal-credentials"

describe("canonical portal credential boundary", () => {
  it("maps enabled flags onto canonical statuses", () => {
    expect(toCanonicalPortalStatus(true)).toBe("enabled")
    expect(toCanonicalPortalStatus(false)).toBe("disabled")
  })

  it("reads canonical status with a legacy active bridge", () => {
    expect(isPortalIntegrationActive("enabled")).toBe(true)
    expect(isPortalIntegrationActive("active")).toBe(true)
    expect(isPortalIntegrationActive("disabled")).toBe(false)
    expect(isPortalIntegrationActive("inactive")).toBe(false)
    expect(isPortalIntegrationActive(null)).toBe(false)
  })

  it("maps portal keys onto credential providers", () => {
    expect(portalCredentialProvider("imovelweb")).toBe("imovelweb")
    expect(portalCredentialProvider("zap_vivareal")).toBe("zap_vivareal")
  })

  it("strips every forbidden secret key while keeping display config", () => {
    const clean = stripSecretConfigKeys({
      export_enabled: true,
      feed_token: "s3cr3t",
      webhook_token: "w",
      access_token: "a",
      secret: "s",
      password: "p",
      codigo_imobiliaria: "123",
    })
    expect(clean).toEqual({ export_enabled: true, codigo_imobiliaria: "123" })
  })

  it("rotates distinct feed and webhook credentials via the canonical RPC", async () => {
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({ data: [{ secret_once: "feed-secret", last4: "1111" }], error: null })
      .mockResolvedValueOnce({ data: [{ secret_once: "hook-secret", last4: "2222" }], error: null })
    const result = await rotatePortalCredentials({ rpc } as never, "imovelweb")
    expect(rpc).toHaveBeenNthCalledWith(1, "rotate_integration_credential", {
      p_provider: "imovelweb",
      p_purpose: "feed_auth",
    })
    expect(rpc).toHaveBeenNthCalledWith(2, "rotate_integration_credential", {
      p_provider: "imovelweb",
      p_purpose: "webhook_auth",
    })
    expect(result).toEqual({
      ok: true,
      rotation: {
        feedSecretOnce: "feed-secret",
        webhookSecretOnce: "hook-secret",
        feedLast4: "1111",
        webhookLast4: "2222",
      },
    })
  })

  it("surfaces rotation failures without persisting anything", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: { message: "denied" } })
    const result = await rotatePortalCredentials({ rpc } as never, "imovelweb")
    expect(result).toEqual({ ok: false, error: "denied" })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it("gates provisioning on a canonical verifier (imovelweb yes, zap parked)", () => {
    expect(canProvisionPortalCredentials("imovelweb")).toBe(true)
    expect(canProvisionPortalCredentials("zap_vivareal")).toBe(false)
  })

  it("refuses zap rotation before any RPC call", async () => {
    const rpc = jest.fn()
    const result = await rotatePortalCredentials({ rpc } as never, "zap_vivareal")
    expect(result.ok).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })
})
