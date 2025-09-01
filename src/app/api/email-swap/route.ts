import { NextRequest, NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Get user email from request or use a default
    // In production, you'd get this from the user's session/auth
    const userEmail = data.userEmail || process.env.SENDGRID_VERIFIED_SENDER;
    
    // Create the email HTML with nice formatting
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your KeepKey Swap Details</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0a0a0a;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #1a1a1a; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.5);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); text-align: center;">
              <img src="https://keepkey.com/images/logo.png" alt="KeepKey" width="150" style="margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Swap Successful! 🎉</h1>
            </td>
          </tr>
          
          <!-- THORChain Badge -->
          <tr>
            <td style="padding: 20px 40px; text-align: center;">
              <div style="display: inline-block; background: #00dc82; padding: 8px 16px; border-radius: 8px;">
                <span style="color: #000; font-weight: bold; font-size: 14px;">⚡ Powered by THORChain</span>
              </div>
            </td>
          </tr>
          
          <!-- Swap Details -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <div style="background: #2a2a2a; border-radius: 12px; padding: 24px; border: 1px solid #333;">
                <h2 style="color: #00dc82; margin: 0 0 20px; font-size: 18px; text-transform: uppercase; letter-spacing: 1px;">Swap Details</h2>
                
                <!-- From/To Display -->
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
                  <div style="text-align: center; flex: 1;">
                    <img src="${data.fromAsset.icon}" alt="${data.fromAsset.symbol}" width="48" height="48" style="border-radius: 50%; margin-bottom: 8px;">
                    <div style="color: #999; font-size: 12px; margin-bottom: 4px;">FROM</div>
                    <div style="color: white; font-size: 20px; font-weight: bold;">${data.fromAsset.amount}</div>
                    <div style="color: #00dc82; font-size: 14px;">${data.fromAsset.symbol}</div>
                  </div>
                  
                  <div style="color: #00dc82; font-size: 24px; padding: 0 20px;">→</div>
                  
                  <div style="text-align: center; flex: 1;">
                    <img src="${data.toAsset.icon}" alt="${data.toAsset.symbol}" width="48" height="48" style="border-radius: 50%; margin-bottom: 8px;">
                    <div style="color: #999; font-size: 12px; margin-bottom: 4px;">TO</div>
                    <div style="color: white; font-size: 20px; font-weight: bold;">${data.toAsset.amount}</div>
                    <div style="color: #00dc82; font-size: 14px;">${data.toAsset.symbol}</div>
                  </div>
                </div>
                
                <!-- Transaction ID -->
                <div style="background: #1a1a1a; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                  <div style="color: #999; font-size: 12px; margin-bottom: 8px;">TRANSACTION ID</div>
                  <div style="color: #00dc82; font-family: monospace; font-size: 12px; word-break: break-all;">
                    ${data.cleanTxid}
                  </div>
                </div>
                
                ${data.memo ? `
                <!-- Memo -->
                <div style="background: #1a1a1a; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                  <div style="color: #999; font-size: 12px; margin-bottom: 8px;">THORCHAIN MEMO</div>
                  <div style="color: #4a9eff; font-family: monospace; font-size: 11px; word-break: break-all;">
                    ${data.memo}
                  </div>
                </div>
                ` : ''}
                
                <!-- Timestamp -->
                <div style="color: #666; font-size: 12px; text-align: center; margin-top: 16px;">
                  Swapped on ${new Date(data.timestamp).toLocaleString()}
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Action Buttons -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom: 12px;">
                    <a href="${data.chainExplorerLink}" style="display: block; background: #4a9eff; color: white; padding: 14px; text-align: center; text-decoration: none; border-radius: 8px; font-weight: bold;">
                      View on Block Explorer →
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 12px;">
                    <a href="${data.thorchainTrackerLink}" style="display: block; background: #00dc82; color: black; padding: 14px; text-align: center; text-decoration: none; border-radius: 8px; font-weight: bold;">
                      Track on THORChain →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background: #0a0a0a; text-align: center; border-top: 1px solid #333;">
              <div style="color: #666; font-size: 12px; margin-bottom: 16px;">
                This email was sent from your KeepKey Vault
              </div>
              <div style="margin-bottom: 16px;">
                <a href="https://keepkey.com" style="color: #00dc82; text-decoration: none; margin: 0 10px;">Website</a>
                <span style="color: #333;">|</span>
                <a href="https://twitter.com/keepkey" style="color: #00dc82; text-decoration: none; margin: 0 10px;">Twitter</a>
                <span style="color: #333;">|</span>
                <a href="https://discord.gg/keepkey" style="color: #00dc82; text-decoration: none; margin: 0 10px;">Discord</a>
              </div>
              <div style="color: #444; font-size: 11px;">
                © ${new Date().getFullYear()} KeepKey. All rights reserved.
              </div>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const msg = {
      to: userEmail,
      from: process.env.SENDGRID_VERIFIED_SENDER || 'support@keepkey.info',
      subject: `✅ KeepKey Swap: ${data.fromAsset.amount} ${data.fromAsset.symbol} → ${data.toAsset.amount} ${data.toAsset.symbol}`,
      html: emailHtml,
    };

    await sgMail.send(msg);

    return NextResponse.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send email' },
      { status: 500 }
    );
  }
}