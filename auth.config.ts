import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import type { NextAuthConfig } from "next-auth"
import { isGoogleAuthConfigured } from "./lib/auth-providers"

export default{
    providers:[
        GitHub({
            clientId:process.env.AUTH_GITHUB_ID,
            clientSecret:process.env.AUTH_GITHUB_SECRET
        }),
        // Google is optional: only registered when its credentials exist
        ...(isGoogleAuthConfigured()
            ? [Google({
                clientId:process.env.AUTH_GOOGLE_ID,
                clientSecret:process.env.AUTH_GOOGLE_SECRET,
            })]
            : []),
    ]
} satisfies NextAuthConfig
