# Googleログインの有効化

2026-09-08、対象プロジェクト masvfncvfhlhwistwhwf の公開 Auth settings API は
`external.google=false` を返した。アプリ側のGoogle OAuth呼び出しは実装済み。
利用者をVercelやSupabaseの管理者として追加する必要はない。

管理者が一度だけ設定する内容:

1. Google Cloud ConsoleでGoogle Auth Platformの同意画面を設定。
   一般利用者向けならExternalとし、公開状態にする。Testingのままだとテストユーザー制限がある。
2. Webアプリ用OAuthクライアントを作成。
   - Authorized JavaScript origins: `https://jasmy-running-app.vercel.app`
   - Authorized redirect URI: `https://masvfncvfhlhwistwhwf.supabase.co/auth/v1/callback`
3. Supabase Authentication > Sign In / Providers > Googleで有効化し、
   Client ID / Client Secretを保存。シークレットをGitHubやチャットに貼らない。
4. Authentication > URL Configuration:
   - Site URL: `https://jasmy-running-app.vercel.app`
   - Redirect URLs: `https://jasmy-running-app.vercel.app`
   プレビューで認証を試す場合は、対象の正確なURLを追加。
5. アプリでGoogleログイン、初回プロフィール作成、再読込、ログアウトを実機確認。

現在のセッションにはGoogle CloudのOAuthクライアント設定を変更する手段がないため、
この設定とユーザー本人のログイン確認は未実施。

GoogleでサインインするのはJasmy Runの利用者アカウント。
Vercel/Supabase管理コンソールのSSO統合や、Jasmy PDL本人確認とは別。
PDLは既存コードでも未接続。PDL連携には正式な認証・API仕様が必要。

公式: https://supabase.com/docs/guides/auth/social-login/auth-google
