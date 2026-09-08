# Apple Health / Apple Watch同期

Duffyは市販のApple Watch歩数表示アプリです。Duffyにトークンを設定して外部サービスへPOSTできるという以前の説明は誤りでした。ブラウザからHealthKitは直接読めません。iPhoneのショートカットまたはHealthKit対応ネイティブアプリを橋渡しに使います。

利用者向け手順: `public/health-sync.html`。手動でショートカットを作成する方式で、署名済みショートカットやネイティブアプリは未提供、iPhone実機での同期は未検証です。Apple Watchのみのサンプルに絞って重複合算を避けるため、ヘルスケアの複数ソース統合済み表示やDuffyと完全一致する保証はありません。

## 受信契約

`POST /rest/v1/rpc/sync_health` をSupabaseのURLに送信。ヘッダーは `apikey: <publishable key>` と `Content-Type: application/json`。

```json
{"p_token":"発行時のみ表示するコード","p_day":"2026-09-08","p_steps":8421,"p_distance_m":6300}
```

- p_day: 利用者のローカル日付。UTCより最大1日先を許容することで日本の午前も同期可能。過去90日まで。
- p_steps: 0〜200000。p_distance_m: 0〜500000メートル。上限超過は拒否、負数とnullは既存関数の仕様で0に補正。送信側は欠測を0に変換せず送信を中止する。
- 同一ユーザー・日付は上書き。ランニングだけでなく歩行を含む距離。GPS走行との合算は禁止。
- ログイン中に `rotate_health_sync_token` で192-bitコードを発行。DBはSHA-256のみ保持。再発行・解除で旧コードを無効化。
- コード所持者は健康集計を変更できる。共有・ログ出力しない。
- public.health_daily_totalsはRLSで本人のみ読み取り可能。匿名はsync_healthのみ実行可能。sourceはapple_health。
- ランキング・チーム・抽選は既存の認定runsのみ参照し、この参考集計は参照しない。

本格的な自動同期は、HealthKitの認可とHKStatisticsCollectionQuery等による集計に対応したiOSアプリを実装し、実機で権限・重複排除・タイムゾーン・バックグラウンド実行を検証する必要があります。

参考: https://apps.apple.com/ca/app/duffy-steps-complication/id1207581673 、 https://developer.apple.com/documentation/healthkit

Security advisor: `sync_health`の匿名SECURITY DEFINER警告は、192-bitトークンで認証する明示的なAPIです。テーブル直接アクセスは禁止し、本人用トークン操作はauth.uid()で制限。https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
