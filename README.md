> **Service pause, 2026-09-11:** Production publishes only the eight static pages in `archive/`, the original stylesheet, and local images. Application source below is retained for future restoration and is not included in the published output. Login, GPS, health sync, and database connections are disabled. Last active source: `archive/before-pause-20260911` (`420b6ff544b0cdcc9d1ffc9e11971b3904b6652e`).

# Jasmy Run

承認済み `jasmy_running_mockup_v2.html` を引き継いだ、Jasmyランニングアプリの初期実装です。元のロゴ・画像・白背景と淡いオレンジ・8画面の構成を保持しています。

## 起動

Node.js 22以上を使用します。

```sh
npm ci
npm test
npm run dev
```

`http://localhost:3000` を開きます。`dev` は起動時にビルドします。編集後は再起動してください。
スマートフォンのGPS計測にはHTTPSが必要です。Vercelにデプロイして実機確認してください。

## 実装した機能

- ログイン画面：端末保存への明示同意、設定後のSupabase認証によるGoogleログイン統一（メール・パスワード方式は廃止）。
- ホーム：実際の記録から今日／今月の距離・時間・ペースを集計。Apple Watch連携時は今日の歩数・距離を別枠で参考表示。
- ラン：実GPS、高精度取得、一時停止／再開／終了、取得した軌跡、実測スプリット。
- 結果・履歴：保存、再表示、保存失敗時の再試行、位置情報を含めない共有画像。
- ランキング：個人／チーム、週／月／全期間、国別。サーバー認定済み・公開同意済みのみ。
- チーム：名前で作成／参加、退出、招待リンク、メンバーと認定距離。
- チャレンジ：開催情報、参加登録、サーバー認定後の1日1口・上限付き集計。
- マイページ：プロフィール、km／mile、運動分析・ランキング公開の同意、JSONエクスポート、実データ削除、Apple Watch（Duffy）連携コードの発行・解除。
- スポンサー広告：チャレンジ詳細の賞品下・走行結果下・ホーム下部の3箇所に「PR」表示付きで掲載。計測中・位置情報許可画面には表示しない。内容は`public/ads.json`で切替可能。

## データの保存先

**端末保存**はIndexedDBです。「この端末だけに保存して使う」で明示的に選択します。ブラウザのデータを消すと記録も消えます。クラウドへの自動移行は行いません。

**クラウド保存**はSupabase Auth + PostgreSQLです。走行ルートとプロフィールは本人のみアクセス可能なRLSを適用します。公開同意したニックネーム・国・認定距離のみランキングへ、チーム参加者のニックネームと認定距離は同じチームへ公開します。研究・マーケティング配信は未実装のため無効です。

## Supabaseの接続

2026-09-07: `Running App on PDL`（`masvfncvfhlhwistwhwf`）へ初期スキーマを適用済み。`supabase.client.json`に公開用の接続URLとpublishable keyを設定しています。秘密鍵は含みません。環境変数で上書きできます。以下の適用手順は別環境を作る場合のものです。


1. Supabaseプロジェクトを用意。
2. SQL Editorで `supabase/migrations/202609070001_initial.sql` を一度実行。続けて `supabase/migrations/202609072_health_sync.sql`（Apple Watch連携用）も実行。
3. Authentication → Sign In / Providers でGoogleを有効化し、Google Cloud ConsoleのOAuthクライアントID・シークレットを設定（下記「Googleログインの設定」）。公開URLをSite URLと許可するRedirect URLsに登録。
4. ビルド環境に次の2つを設定。
   - `PUBLIC_SUPABASE_URL`: `https://<project>.supabase.co`
   - `PUBLIC_SUPABASE_ANON_KEY`: publishable key または anon key
5. `npm run build` で再ビルド。

### Googleログインの設定

メール・パスワード方式は廃止し、Googleログインに統一した。VercelやSupabaseのプロジェクトへ利用者を個別に招待する必要はない。

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials)でOAuthクライアントID（種類: ウェブアプリケーション）を作成。
2. 承認済みのリダイレクトURIに `https://<project>.supabase.co/auth/v1/callback` を追加。
3. SupabaseダッシュボードのAuthentication → Providers → GoogleでクライアントID・シークレットを設定して有効化。
4. Authentication → URL ConfigurationのSite URLと Redirect URLsに、公開しているアプリのURL（例: `https://<app>.vercel.app`）を追加。
5. ローカル確認用に `http://localhost:3000` もRedirect URLsに追加できる。

この設定は一度だけでよく、以降はどのGoogleアカウントでもそのままログインできる。

**service_roleキー、secret keyはブラウザに渡さないでください。** ビルドで検出できる形式は拒否します。
ローカルで設定する場合は `.env.example` を `.env` にコピーし、`node --env-file=.env scripts/dev.mjs` で起動します。`.env`はGit管理対象外です。

## Vercelへの公開

1. VercelでこのGitHubリポジトリをImport。
2. Framework PresetはOther、Build Commandは `npm run build`、Output Directoryは `dist`（vercel.jsonに設定済み）。
3. 上記の公開用Supabase環境変数をPreview/Productionに設定してDeploy。
4. 発行URLをSupabaseの認証URL設定へ追加。

現在は設定済みのSupabaseへ接続するビルドです。両方の環境変数を空文字に設定すると端末保存のみのビルドになります。

## PDLと本番提供までに必要なもの

PDLの認証仕様・接続先・クライアント情報が未提供なので、**PDL認証・PDL保存はまだ実装していません**。元モックの偽の接続成功表示は削除しました。`docs/pdl-integration.md`に接続時の確認事項を整理しています。

走行認定も未実装です。クライアントの速度フィルターはGPSノイズ対策であり、不正防止の証明ではありません。新規記録は必ず `pending` です。認定API・判定器を用意するまではランキングへの加算と抽選口数は発生しません。認定状態の変更は特権サーバーだけが行えます。

チャレンジは実データを未登録です。北海道の画像は承認済み企画イメージであり、実際の景品・スポンサー・抽選開始を意味しません。

- 背景地図は未接続。実GPS軌跡のみ描画します。
- ブラウザを前面に置いた計測を対象にしています。画面ロック・バックグラウンドの継続計測保証にはネイティブアプリ化が必要です。
- 進行中の記録はメモリ上です。リロード／タブ終了では失われます。離脱時にブラウザ標準の確認を要求します。保存に失敗した記録は再保存するまで画面を閉じないでください。
- GPS精度50m超、取得間隔30秒超、8m/s超の区間を加算しません。閾値は実機評価が必要です。
- カロリーは体重60kgを仮定した推定値。医療的な精度はありません。
- 個人の当日・月次は端末のタイムゾーン、ランキングと抽選口数はUTC日付です。
- チームは名前で誰でも参加できる公開チーム方式。退出前の認定記録はその当時のチームに残ります。
- 正式な利用規約・プライバシーポリシー、認定運用、景品と抽選処理、アカウント削除運用を確定してから一般公開してください。

## Apple Watch（Duffy）連携

Apple Watchで記録した歩数・走行距離を、利用者自身が用意する自作アプリ／ショートカット「Duffy」から
HTTP POSTでこのアプリへ同期できる。マイページの「Apple Watch連携（Duffy）」から連携コードを発行し、
Duffy側にそのコードとエンドポイントを設定する。技術仕様は[docs/apple-watch-sync.md](docs/apple-watch-sync.md)を参照。

歩数・距離はホームとマイページに参考表示するのみで、GPSによる実走行記録とは別に保存する。走行認定・ランキング・
チーム距離・チャレンジのエントリー計算には使用しない。連携コードはSHA-256ハッシュのみサーバーに保存し、
平文は発行時に一度だけ表示する。既存のSupabase環境には `supabase/migrations/202609072_health_sync.sql` の適用が必要。

## 構成・検証

- `public/`: 既存UI・CSS・元画像（画像データを再生成せず抽出）、`ads.json`（スポンサー広告3枠の差し替え用データ）
- `src/app.js`: 画面制御と実操作
- `src/tracker.js`: GPS距離・時間・スプリット・集計
- `src/data.js`: 端末保存／Supabaseのデータアクセス
- `src/ads.js`: `public/ads.json`を読み込んでスポンサー広告枠を描画
- `supabase/migrations/`: RLS、権限制御、集計RPC、Apple Watch（Duffy）連携用トークン・同期関数
- `docs/apple-watch-sync.md`: Apple Watch（Duffy）連携のHTTP契約
- `tests/`: GPS計算、停止／再開、日次集計、PostgreSQL互換実行環境での権限・認定・抽選口数テスト

`npm test` と `npm run build` を実行済み。Supabaseへの適用と7テーブルのRLS・権限設定を確認済み。Vercel公開、実機GPS、メール到達、PDL接続は未検証です。

現段階ではフレームワークを全面置換せず、承認済みHTML/CSSをES Modulesとして分離しました。これにより画像やレイアウトを引き継ぎつつ、Vercelでそのままビルドできます。

### Supabaseアドバイザーの確認

4件の警告は、ログイン利用者へ意図的に公開する限定RPC（本人データ削除、所属チーム取得、公開同意済みランキング、チーム参加）がSECURITY DEFINERであることの通知です。各関数は本人IDまたは公開同意を条件とし、anonの実行権限を取り消しています。teamsのポリシー未作成通知は直接アクセスを禁止してRPC経由に限定する設計によるものです。
参照: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## GPS・画像・言語の更新

- GPSエラーで自動停止しないよう修正。粗い位置も参考位置として表示し、距離計測は精度50m以内の点のみ。再取得と権限エラーの案内を追加。端末のGPS権限そのものはアプリから変更できません。
- プロフィールからJPEG/PNG/WebP（10MB以下）を選択、中央切り抜き・256px JPEG変換後に保存。本人のprofiles行に保存し、ゲストではIndexedDBに保存。新環境では初期SQLの後に `docs/profile-avatar.sql` を実行してください。既存環境には適用済みです。
- 設定のLanguageで日本語・英語を切替。選択はブラウザに保存。
- 北海道バナーを写真とHTMLテキストに分離。文言は「走って北海道グルメを当てよう！」。抽選未開催の注記は継続。

## iPhone / Safari の位置情報フロー

START RUN、または未計測時のランタブ → 位置情報を許可する → Safariで許可 → 現在地確認 → この位置でランニング開始。拒否・未対応・タイムアウト時は設定手順と再試行を表示します。iOS設定への非公開URLや強制的な許可変更は使用しません。

位置情報なしでも画面を見ることができます。「軌跡の表示例」は架空の座標による描画確認で、tracker・保存・ランキングには渡しません。実計測の軌跡は精度50m以内の有効なGPS点だけを使用します。拡大画面の高さを明示し、軌跡を表示できるよう修正しました。

検証: 390×844のChromiumブラウザで、ボタン押下前の未取得、拒否→再試行→許可、現在地点、位置更新による距離・軌跡、拡大画面をモックGPSで確認。iPhone実機のSafari・ネイティブ許可ダイアログ・衛星受信は未検証です。

画面確認用スクリーンショット（Chromium・模擬GPS、日本語フォントを確認環境に追加）: [位置情報許可](docs/screenshots/location-permission.png)、[軌跡](docs/screenshots/running-route-simulated.png)。実機GPSの検証結果ではありません。

## 毎月のグルメチャレンジと当選者

モックの時計・電波・Wi-Fi・電池表示を削除。画像は文字の混入しない生成画像（賞品イメージ）に差替え、モバイルでは縦組みで表示します。

`docs/challenge-winners.sql` で当選者掲示用テーブルを作成できます。既存Supabaseには適用済み。運営が確定した当選者を管理者権限で登録し、開催月・企画名・ニックネーム・公開日時を設定すると公開済みの当選者だけが掲示されます。ユーザーや匿名アクセスには編集権限を付与しません。架空の当選者は登録しません。毎月の企画登録と抽選の自動実行・運営管理画面は別途必要です。

賞品受取にはPDLによるマイナンバーカード認証が必要である旨を表示します。PDLの接続仕様が未提供のため認証自体は未実装です。カード番号・画像の収集画面や認証成功の疑似表示は設けません。本人認証完了をサーバーで検証してから受取申請を許可する処理は、公式API仕様の確定後に接続します。
