# Apple Watch（Duffy）連携の技術仕様

Apple Watchのデータは、Apple純正のHealthKitへ記録されます。このアプリはHealthKitへ直接接続しません。
ユーザー自身が用意する自作アプリ／ショートカット「Duffy」がHealthKitから歩数・走行距離を読み取り、
このアプリのSupabaseプロジェクトへHTTP POSTすることでデータを届けます。

歩数・距離は**参考表示のみ**です。GPSによる実走行記録（`public.runs`）とは別テーブルに保存し、
走行認定・ランキング・チーム距離・チャレンジのエントリー計算には一切使用しません。

## 認証の仕組み

1. ログイン済みユーザーがマイページ「Apple Watch連携（Duffy）」から連携コードを発行する（`rpc/rotate_health_sync_token`）。
2. コードは192ビットの乱数で、平文はこのときだけ画面に表示される。サーバーにはSHA-256ハッシュのみ保存する。
3. Duffyはこのコードを保持し、送信のたびに`p_token`として送る。
4. サーバー側の`sync_health`関数がハッシュを突き合わせ、一致したユーザーの`health_daily_totals`を更新する。

コードはパスワードと同様の機密情報として扱うこと。漏えいした場合はマイページから再発行（無効化を兼ねる）できる。

## エンドポイント

```
POST https://<project>.supabase.co/rest/v1/rpc/sync_health
apikey: <公開のpublishable/anon key>
Content-Type: application/json

{
  "p_token": "発行された連携コード",
  "p_day": "2026-09-07",
  "p_steps": 8421,
  "p_distance_m": 6300
}
```

- `p_day` はローカル日付（`YYYY-MM-DD`）。未来日、および91日以上前の日付は拒否される。
- `p_steps` は0〜200,000、`p_distance_m` は0〜500,000（メートル）の範囲外は保存時に丸められる。
- 同じ`p_token`・`p_day`の組み合わせで再送すると、その日の値を上書きする（累積ではなく最新値）。
- 失敗時はPostgRESTの標準エラー形式でHTTP 400番台を返す。トークンが不正な場合も理由は返さない。

## 適用が必要なマイグレーション

`supabase/migrations/202609072_health_sync.sql` を、既存のSupabaseプロジェクトのSQL Editorで一度実行する。
`pgcrypto`拡張を有効化し、`health_sync_tokens`・`health_daily_totals`テーブルと、
`rotate_health_sync_token` / `revoke_health_sync_token` / `health_sync_status` / `sync_health`の4つの関数を作成する。

## Duffy側の実装メモ

- HealthKitの`HKQuantityTypeIdentifierStepCount`・`HKQuantityTypeIdentifierDistanceWalkingRunning`を
  当日分だけ集計し、上記のリクエストを送る運用を想定している。
- 送信頻度に制限はないが、同日中は最新の送信内容で上書きされるため、1日数回で十分。
- iPhoneの「ショートカット」アプリで「HealthKit変数を取得」→「Webリクエストを取得」の組み合わせでも実装できる。
