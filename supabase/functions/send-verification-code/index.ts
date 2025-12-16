import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendCodeRequest {
  email: string;
  type: "signup" | "password_reset";
  language?: "en" | "nl";
}

// Generate cryptographically secure 6-digit code
function generateSecureCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Use modulo to get a 6-digit number, pad with zeros if needed
  const code = (array[0] % 1000000).toString().padStart(6, "0");
  return code;
}

// Simple hash function using Web Crypto API (bcrypt alternative for Deno)
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return base64Encode(hashBuffer);
}

// Email templates
function getVerificationEmailHtml(code: string, type: string, language: string): string {
  const isReset = type === "password_reset";
  
  const content = {
    en: {
      title: isReset ? "Reset Your Password" : "Verify Your Email",
      subtitle: isReset 
        ? "You requested to reset your password" 
        : "Complete your Rhosonics account registration",
      codeLabel: "Your verification code:",
      expiryNote: "This code expires in 10 minutes",
      securityNote: "If you didn't request this, you can safely ignore this email.",
      footer: "Rhosonics MES Production System"
    },
    nl: {
      title: isReset ? "Wachtwoord Resetten" : "Verifieer Je E-mail",
      subtitle: isReset 
        ? "Je hebt gevraagd om je wachtwoord te resetten" 
        : "Voltooi je Rhosonics account registratie",
      codeLabel: "Je verificatiecode:",
      expiryNote: "Deze code verloopt over 10 minuten",
      securityNote: "Als je dit niet hebt aangevraagd, kun je deze e-mail veilig negeren.",
      footer: "Rhosonics MES Productiesysteem"
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a6b3d 0%, #2e8b52 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">
                rhosonics
              </h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                MES Production System
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="margin: 0 0 8px; color: #1a1a2e; font-size: 22px; font-weight: 600;">
                ${t.title}
              </h2>
              <p style="margin: 0 0 32px; color: #64748b; font-size: 15px; line-height: 1.5;">
                ${t.subtitle}
              </p>
              
              <p style="margin: 0 0 12px; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">
                ${t.codeLabel}
              </p>
              
              <!-- Code Box -->
              <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 2px solid #86efac; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <span style="font-family: 'SF Mono', 'Roboto Mono', monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1a6b3d;">
                  ${code}
                </span>
              </div>
              
              <p style="margin: 0 0 24px; color: #f59e0b; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 16px;">⏱️</span> ${t.expiryNote}
              </p>
              
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
              
              <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                🔒 ${t.securityNote}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                ${t.footer}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, type, language = "en" }: SendCodeRequest = await req.json();

    // Validate email domain (only @rhosonics.com allowed)
    const emailLower = email.toLowerCase().trim();
    if (!emailLower.endsWith("@rhosonics.com")) {
      // Don't reveal domain restriction for security - just say "check your email"
      console.log(`Blocked non-rhosonics email attempt: ${emailLower}`);
      return new Response(
        JSON.stringify({ success: true, message: "If this email is registered, you will receive a code" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // For password reset, check if user exists
    if (type === "password_reset") {
      const { data: existingUser } = await supabase.auth.admin.listUsers();
      const userExists = existingUser?.users?.some(u => u.email?.toLowerCase() === emailLower);
      if (!userExists) {
        // Don't reveal if user exists - return success anyway
        console.log(`Password reset attempted for non-existent user: ${emailLower}`);
        return new Response(
          JSON.stringify({ success: true, message: "If this email is registered, you will receive a code" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // For signup, check if user already exists
    if (type === "signup") {
      const { data: existingUser } = await supabase.auth.admin.listUsers();
      const userExists = existingUser?.users?.some(u => u.email?.toLowerCase() === emailLower);
      if (userExists) {
        return new Response(
          JSON.stringify({ success: false, error: "This email is already registered. Please sign in instead." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Rate limiting: max 3 codes per email per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentCodes, error: rateError } = await supabase
      .from("verification_codes")
      .select("id")
      .eq("email", emailLower)
      .eq("code_type", type)
      .gte("created_at", oneHourAgo);

    if (rateError) {
      console.error("Rate limit check error:", rateError);
      throw new Error("Failed to check rate limit");
    }

    if (recentCodes && recentCodes.length >= 3) {
      console.log(`Rate limit exceeded for: ${emailLower}`);
      return new Response(
        JSON.stringify({ success: false, error: "Too many verification attempts. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Invalidate any existing unused codes for this email and type
    await supabase
      .from("verification_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("email", emailLower)
      .eq("code_type", type)
      .is("used_at", null);

    // Generate and hash the code
    const code = generateSecureCode();
    const codeHash = await hashCode(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Get IP and user agent from request
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Store the hashed code
    const { error: insertError } = await supabase
      .from("verification_codes")
      .insert({
        email: emailLower,
        code_hash: codeHash,
        code_type: type,
        expires_at: expiresAt,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

    if (insertError) {
      console.error("Failed to store verification code:", insertError);
      throw new Error("Failed to create verification code");
    }

    // Send the email with Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);
    const subject = type === "password_reset" 
      ? (language === "nl" ? "Wachtwoord Resetten - Rhosonics" : "Password Reset - Rhosonics")
      : (language === "nl" ? "Verificatiecode - Rhosonics" : "Verification Code - Rhosonics");

    const { error: emailError } = await resend.emails.send({
      from: "Rhosonics MES <noreply@rhosonics.com>",
      to: [emailLower],
      subject,
      html: getVerificationEmailHtml(code, type, language),
    });

    if (emailError) {
      console.error("Failed to send email:", emailError);
      // Still return success to not reveal email delivery status
    }

    console.log(`Verification code sent successfully to: ${emailLower} (type: ${type})`);

    return new Response(
      JSON.stringify({ success: true, message: "Verification code sent" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-verification-code:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
