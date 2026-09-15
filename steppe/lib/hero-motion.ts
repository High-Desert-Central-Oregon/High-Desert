/** Network Information is optional (not exposed by every browser). */
export type SkyConnection = {
  saveData?: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
};

export function shouldAnimateSky({
  reducedMotion,
  online,
  connection,
  responseTime = 0,
}: {
  reducedMotion: boolean;
  online: boolean;
  connection?: SkyConnection;
  responseTime?: number;
}) {
  return !(
    reducedMotion ||
    !online ||
    connection?.saveData ||
    ["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? "") ||
    (connection?.downlink !== undefined && connection.downlink < 1.5) ||
    (connection?.rtt !== undefined && connection.rtt >= 500) ||
    // Conservative fallback when a browser cannot report connection quality.
    (!connection && responseTime > 1500)
  );
}
