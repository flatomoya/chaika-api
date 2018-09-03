chaika-api
==========

[chaika](https://github.com/chaika/chaika) に 2ch の API を実装する非公式なプロジェクトです。

* [プロジェクトの概要](https://github.com/masami-dev/chaika-api/wiki)
* [2ch API 拡張部の説明](https://github.com/masami-dev/chaika-api/wiki/%E4%BB%98%E5%B1%9E%E6%96%87%E6%9B%B8%28README%29)

### 使用上の注意

このバージョンの chaika は、アドオン名やアドオンIDが元のオリジナル版 chaika とは別のものに変更されているため、オリジナル版とは別のアドオンとして Firefox に認識されます。そのため、オリジナル版と同時にインストールすることができてしまいますが、オリジナル版と同時にインストールされると正常に動作しません。すなわち、オリジナル版との共存はできません。

従いまして、オリジナル版 chaika から移行する際には、**必ず、アドオンマネージャにてオリジナル版 chaika を削除（アンインストール）した後にインストールしてください**。オリジナル版 chaika を削除してもデータや設定はそのまま残り、それらは全て引き継がれます。

2ch API サポートは非公式対応となっており、2ch API 機能を働かせるには所定のAPIキーを入力する必要があります。初めて使用する際には、[2ch API 拡張部の説明](https://github.com/masami-dev/chaika-api/wiki/%E4%BB%98%E5%B1%9E%E6%96%87%E6%9B%B8%28README%29) を参照の上、必要な初期設定を行なってください。

### オリジナル版 chaika との違い

このバージョンの chaika は、元々の chaika に対し、2ch API サポートを筆頭にいくつかの機能を追加し、既知の不具合を修正したカスタム版となっています。

オリジナル版からの変更点についての詳細は chaika-api 1.7.3 リリースノートの [更新履歴](https://github.com/masami-dev/chaika-api/wiki/chaika-api-1.7.3-%E3%83%AA%E3%83%AA%E3%83%BC%E3%82%B9%E3%83%8E%E3%83%BC%E3%83%88#%E6%9B%B4%E6%96%B0%E5%B1%A5%E6%AD%B4) を参照してください。

#### 主な機能追加・機能強化

末尾の (XXX.zip) という表記は、[公式アップローダー](http://bbs2ch.osdn.jp/uploader/upload.php) に上げられているパッチが元になっていることを意味します。

* 2ch API サポートの追加 (2ch API extension v0.14)
* 外部板に対する動作を2chと同等にできる機能を追加 ([844.zip](http://bbs2ch.osdn.jp/uploader/img/844.zip))
* 5ch.net ドメインを 2ch.net の別名として認識させるようにした
* https: で始まるスレッドURL・板URLを認識できるようにした
* https: の板URL・スレッドURLを http: に修正して開くオプションを追加
* chaika履歴の保存期間をデフォルトで60日に制限するようにした
* chaikaサイドバー板一覧にてキーボードで板を開けるようにした（Enter，Ctrl+Enter）
* chaikaサイドバー板一覧リストを複数選択動作できるようにした
* ログマネージャにてキーボードでスレッドを開けるようにした（Enter，Ctrl+Enter）
* あぼーんマネージャNGExのリストボックスをサイズ変更可能にした

#### 主な不具合修正

* サーバの移転先URLを正しく認識できない場合があるのを修正
* 新着レス取得のとき希にログが壊れることがある不具合を修正
* トリップキーに&<>◆などがあると正しいトリップがプレビューに表示されない現象を修正
* 「常に最前面にする」が有効のときに書き込みウィザードを複数開くと競合状態になる現象を修正
* 存在しない検索エンジンがデフォルトになっているとサイドバーに何も表示されない現象を修正
* NGEx の自動NGIDで同じIDが重複して登録される不具合を修正
* あぼーんマネージャで多数の項目を一度に削除した後にブラウザがビジー状態になる現象を修正
* Firefox 44 以降でスレ一覧などのコンテキストメニューが効かなくなっていたのを修正
* Firefox 45 以降であぼーん(NGEx)＆置換マネージャのエントリが削除できなくなったのを修正
* Firefox 46 以降でスレッド表示が 404 Not Found となり動作しない不具合を修正
* Firefox 50 以降でスレ一覧・ログマネージャからの drag&drop ができない不具合を修正
* Firefox 53 以降でスキンから書き込みウィザードを開けない不具合を修正
* Firefox 54 以降で chaika 独自のプロキシ設定をするとネットワークエラーになるのを修正


----

**以下、オリジナル版 chaika の `README.md`**

----

chaika
======

Firefox に 2ちゃんねる専用ブラウザ相当の機能を追加するアドオンです。


Install
---

[Mozilla 公式サイト](https://addons.mozilla.org/ja/firefox/addon/chaika/)よりインストール可能です。


For Users
---

### マニュアル・ヘルプ
* [オンラインヘルプ](https://github.com/chaika/chaika/wiki)
* [FAQ(よくある質問)](http://bbs2ch.sourceforge.jp/?page=FAQ)

### コミュニティ
* [2ch現行スレッド](http://dig.2ch.net/?keywords=bbs2chreader%2Fchaika&AndOr=0&maxResult=50&atLeast=1&Sort=5&Link=1&Bbs=all&924=1)
* [スレッド避難所](http://jbbs.shitaraba.net/computer/44179/)
* [公式アップローダー](http://bbs2ch.sourceforge.jp/uploader/upload.php)
* [スキン一覧](http://bbs2ch.sourceforge.jp/?page=Skin%2F0.4.5)

### 関連
* [bbs2chreader 公式サイト](http://bbs2ch.sourceforge.jp/)


For Developers
---
### 関連アドオン・スキン開発
* [開発者の方向けオンラインマニュアル](https://github.com/chaika/chaika/wiki#%E9%96%8B%E7%99%BA%E8%80%85%E3%81%AE%E6%96%B9%E5%90%91%E3%81%91)


### chaika 本体の開発
メイン開発者として参画する、パッチを投稿する、Pull Requestを行う、オンラインヘルプを整備するなど、どのような形での参加であれ大歓迎です。

#### ライセンス
- [MPL 1.1/GPL 2.0/LGPL 2.1](https://github.com/chaika/chaika/blob/develop/chaika/license.txt)


#### テスト環境
* [chaika 開発版](https://github.com/chaika/chaika/tree/develop)

* [開発用テスト板](http://jbbs.shitaraba.net/computer/43679/)

#### バグ一覧・ToDo
* 最新バグ一覧: [Issues](https://github.com/chaika/chaika/issues?q=is%3Aopen+is%3Aissue+-label%3Afixed)

* 更新が停止したバグ一覧など  
    (新規投稿は上のバグ一覧にお願いします)
    * [旧旧ToDo](https://spreadsheets.google.com/pub?key=pbbe5TFNb21RVxOf7ygNJfg) : b2r 0.5系 (flysonさん作成)
    * [旧ToDo](http://d.hatena.ne.jp/nazodane/20080609/1212999112) : b2r 0.5系 (Nazoさん作成)
    * [launchpad](https://bugs.launchpad.net/bbs2ch) : b2r バグトラッカー
    * [あぼーん改善案](http://bbs2ch.sourceforge.jp/?page=%A4%A2%A4%DC%A1%BC%A4%F3%B2%FE%C1%B1)
    * [書きこみ改善案](http://bbs2ch.sourceforge.jp/?page=%BD%F1%A4%AD%B9%FE%A4%DF%B2%FE%C1%B1)
    * [bbs2chreader開発板](http://jbbs.shitaraba.net/computer/41231/): Nazoさん作成の旧開発板

#### ブランチモデル
基本規則は [ぼくが実際に運用していたGitブランチモデルについて ::ハブろぐ](http://havelog.ayumusato.com/develop/git/e513-git_branch_model.html) に準拠。

* **master**  
  主にリリース版のタグ付専用として使用。直接コミットはせず、基本的にマージのみ。
* **develop**  
  開発用のブランチ。
* **feature**  
  大規模修正用のブランチ。
* **release**  
  リリース候補用のブランチ。AMOは登録に時間がかかるため、登録が完了するまではこちらでバグフィックスする。開発はdevelopブランチで継続する。
