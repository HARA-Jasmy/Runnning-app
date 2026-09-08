# メールアドレスのみのログイン

ログイン画面の公開入口をメール認証リンク方式に統一。Googleと端末保存の入口は非表示。
盾アイコンとオレンジ色は維持。新規登録もsignInWithOtpのshouldCreateUser=trueで処理する。
メールリンクの戻り先にはアプリを開いたHTTPS originを指定し、クエリや共有用トークンは付けない。
既存のSupabaseセッションは維持し、受信リンクのセッション復元にはSDKを使用する。

Supabase設定: Emailプロバイダー（確認時は有効）、Site URLとRedirect URLsに
https://jasmy-running-app.vercel.app を設定する。メールテンプレートはConfirmationURLを使用する。
メール送信サービスの宛先制限・送信上限はSupabaseの設定に依存する。

認証メールを実在アドレスへ送るテストは行っていない。メール受信・リンクからの復帰は実機確認が必要。
認証処理はSupabaseであり、Jasmy PDLの正式な認証APIやデータ保管先との接続が完成したことは意味しない。
旧Google設定手順は過去の構成に関する参考資料。

公式: https://supabase.com/docs/guides/auth/auth-email-passwordless
