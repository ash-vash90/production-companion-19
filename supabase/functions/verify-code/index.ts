import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import { SignJWT } from "https://deno.land/x/jose@v5.2.0/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyCodeRequest {
  email: string;
  code: string;
  type: "signup" | "password_reset";
}

// Hash function matching the one in send-verification-code
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return base64Encode(hashBuffer);
}

// Constant-time string comparison to prevent timing attacks
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Generate a signed JWT token for verified action
async function generateVerificationToken(email: string, type: string): Promise<string> {
  const secretKey = new TextEncoder().encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  
  const token = await new SignJWT({ 
    email, 
    type,
    verified: true 
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m") // Token valid for 15 minutes to complete signup/reset
    .sign(secretKey);
  
  return token;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, code, type }: VerifyCodeRequest = await req.json();

    // Validate input
    if (!email || !code || !type) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid code format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailLower = email.toLowerCase().trim();

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the most recent unused code for this email and type
    const { data: verificationRecord, error: fetchError } = await supabase
      .from("verification_codes")
      .select("*")
      .eq("email", emailLower)
      .eq("code_type", type)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !verificationRecord) {
      console.log(`No valid verification code found for: ${emailLower}`);
      return new Response(
        JSON.stringify({ success: false, error: "No valid verification code found. Please request a new code." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if code has expired
    if (new Date(verificationRecord.expires_at) < new Date()) {
      console.log(`Expired code attempted for: ${emailLower}`);
      return new Response(
        JSON.stringify({ success: false, error: "Verification code has expired. Please request a new code." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check attempt count
    if (verificationRecord.attempts >= verificationRecord.max_attempts) {
      console.log(`Max attempts exceeded for: ${emailLower}`);
      // Mark as used to prevent further attempts
      await supabase
        .from("verification_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", verificationRecord.id);

      return new Response(
        JSON.stringify({ success: false, error: "Too many incorrect attempts. Please request a new code." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Hash the provided code and compare
    const providedHash = await hashCode(code);
    const isValid = secureCompare(providedHash, verificationRecord.code_hash);

    if (!isValid) {
      // Increment attempts
      await supabase
        .from("verification_codes")
        .update({ attempts: verificationRecord.attempts + 1 })
        .eq("id", verificationRecord.id);

      const remainingAttempts = verificationRecord.max_attempts - verificationRecord.attempts - 1;
      console.log(`Invalid code attempt for: ${emailLower}, remaining: ${remainingAttempts}`);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid verification code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.` 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Code is valid - mark as used
    await supabase
      .from("verification_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", verificationRecord.id);

    // Generate verification token for completing signup or reset
    const verificationToken = await generateVerificationToken(emailLower, type);

    console.log(`Code verified successfully for: ${emailLower} (type: ${type})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Code verified successfully",
        token: verificationToken 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in verify-code:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
