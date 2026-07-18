/**
 * Proctor365-branded HTML email templates for health alerts.
 * Visual style aligned with proctor-communication-service OTP/alert emails.
 */

function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function detailRow(label, value) {
	if (value === undefined || value === null || value === "") return "";
	return `
		<tr>
			<td style="padding:8px 0;font-size:13px;color:#6b7280;width:140px;vertical-align:top;">
				${escapeHtml(label)}
			</td>
			<td style="padding:8px 0;font-size:14px;color:#111827;font-weight:600;vertical-align:top;">
				${escapeHtml(value)}
			</td>
		</tr>`;
}

function serviceCard(transition, isDown) {
	return `
		<div style="margin-top:14px;padding:14px 16px;background:#fafafc;border:1px solid #e5e7eb;border-radius:10px;">
			<div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:8px;">
				${escapeHtml(transition.serviceName)}
			</div>
			<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
				${detailRow("Service ID", transition.serviceId)}
				${detailRow("Status", `${transition.from} → ${transition.to}`)}
				${detailRow("Time (UTC)", transition.at)}
				${detailRow("Health URL", transition.url || "n/a")}
				${isDown ? detailRow("Error", transition.error) : ""}
				${isDown ? detailRow("HTTP status", transition.httpStatus) : ""}
			</table>
		</div>`;
}

function buildHealthAlertEmail(transitionsInput) {
	const transitions = Array.isArray(transitionsInput)
		? transitionsInput
		: [transitionsInput];

	if (!transitions.length) {
		throw new Error("No transitions provided for health alert email");
	}

	const env = process.env.NODE_ENV || "development";
	const year = new Date().getFullYear();
	const isDown = transitions[0].to === "DOWN";
	const count = transitions.length;
	const names = transitions.map((t) => t.serviceName);
	const hasCritical = transitions.some((t) => t.critical);

	const subject =
		count === 1
			? isDown
				? `[Proctor365 Alert] ${names[0]} is DOWN`
				: `[Proctor365 Recovery] ${names[0]} is back UP`
			: isDown
				? `[Proctor365 Alert] ${count} services are DOWN`
				: `[Proctor365 Recovery] ${count} services are back UP`;

	const title =
		count === 1
			? isDown
				? "Service Down Alert"
				: "Service Recovery"
			: isDown
				? "Multiple Services Down"
				: "Multiple Services Recovered";

	const badgeBg = isDown ? "#FDECEA" : "#E8F5E9";
	const badgeColor = isDown ? "#D32F2F" : "#2E7D32";
	const badgeText = isDown
		? count === 1
			? "DOWN"
			: `${count} DOWN`
		: count === 1
			? "UP"
			: `${count} UP`;

	const intro =
		count === 1
			? isDown
				? `The monitored service <strong>${escapeHtml(names[0])}</strong> is currently unavailable.`
				: `The monitored service <strong>${escapeHtml(names[0])}</strong> is back online.`
			: isDown
				? `<strong>${count}</strong> monitored services are currently unavailable.`
				: `<strong>${count}</strong> monitored services are back online.`;

	const impact = hasCritical
		? isDown
			? "Impact: One or more critical services are down — exam launch may be blocked until they recover."
			: "Impact: Critical services recovered — exam launch should be unblocked if all other services are healthy."
		: "";

	const textLines = [
		isDown
			? count === 1
				? "Service down alert"
				: `${count} services down`
			: count === 1
				? "Service recovery"
				: `${count} services recovered`,
		`Environment: ${env}`,
		"",
	];

	for (const transition of transitions) {
		textLines.push(`- ${transition.serviceName} (${transition.serviceId})`);
		textLines.push(`  Status: ${transition.from} -> ${transition.to}`);
		textLines.push(`  Time (UTC): ${transition.at}`);
		textLines.push(`  Health URL: ${transition.url || "n/a"}`);
		if (isDown && transition.error) textLines.push(`  Error: ${transition.error}`);
		if (isDown && transition.httpStatus) {
			textLines.push(`  HTTP status: ${transition.httpStatus}`);
		}
		textLines.push("");
	}

	if (impact) textLines.push(impact);
	textLines.push("", "Thank you,", "Proctor 365 Team", "support@proctor365.ai");

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fa;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f6fa;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(17,24,39,0.08);">

          <!-- HEADER -->
          <tr>
            <td style="background:#1f2237;padding:22px 28px;text-align:center;">
              <div style="font-family:Segoe UI,Arial,sans-serif;color:#CFA935;font-size:22px;font-weight:700;">
                ${escapeHtml(title)}
              </div>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:26px 28px 10px 28px;font-family:Segoe UI,Arial,sans-serif;">
              <div style="margin:0 0 16px 0;text-align:center;">
                <span style="display:inline-block;background:${badgeBg};color:${badgeColor};padding:8px 16px;border-radius:6px;font-size:13px;font-weight:700;letter-spacing:0.5px;">
                  ${badgeText}
                </span>
              </div>

              <div style="font-size:15px;line-height:24px;color:#4b5563;">
                ${intro}
              </div>

              <div style="margin-top:10px;font-size:13px;color:#6b7280;">
                Environment: <strong style="color:#111827;">${escapeHtml(env)}</strong>
              </div>

              ${
								impact
									? `<div style="margin-top:14px;padding:12px 14px;background:#CFA9351A;border:1px solid #e5e7eb;border-radius:10px;font-size:13px;line-height:20px;color:#585858;">
                ${escapeHtml(impact)}
              </div>`
									: ""
							}

              ${transitions.map((t) => serviceCard(t, isDown)).join("")}

              <div style="margin-top:18px;font-size:14px;color:#4b5563;line-height:22px;">
                If you need assistance, contact
                <a href="mailto:support@proctor365.ai" style="color:#CFA935;text-decoration:none;font-weight:600;">support@proctor365.ai</a>
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#fafafc;border-top:1px solid #e5e7eb;padding:16px 28px;text-align:center;font-family:Segoe UI,Arial,sans-serif;">
              <div style="font-size:12.5px;color:#6b7280;">
                Thank you,<br/>
                Proctor 365 Team
              </div>
              <div style="margin-top:8px;font-size:12px;color:#9ca3af;">
                &copy; ${year} Proctor 365
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

	return {
		subject,
		text: textLines.join("\n"),
		html,
	};
}

module.exports = {
	buildHealthAlertEmail,
};
