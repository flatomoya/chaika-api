/* See license.txt for terms of usage */

Components.utils.import("resource://chaika-modules/ChaikaCore.js");


var Ff2ch = {

    id: '01.ff2ch.syoboi.jp',

    name: '5ch検索 (ff5ch.syoboi.jp)',

    version: '1.0.3',

    charset: 'utf-8',

    url: 'https://ff5ch.syoboi.jp/?q=%%TERM%%',

    search: function(query){
        return new Promise((resolve, reject) => {
            const url = 'https://ff5ch.syoboi.jp/?alt=rss&q=' +
                        encodeURIComponent(ChaikaCore.io.unescapeHTML(query));
            const XMLHttpRequest = Components.Constructor("@mozilla.org/xmlextras/xmlhttprequest;1");
            let req = XMLHttpRequest();

            req.addEventListener('error', reject, false);
            req.addEventListener('load', () => {
                if(req.status !== 200 || !req.responseText){
                    reject('Unable to connect. (status: ' + this._req.status + ')');
                    return;
                }

                if(!req.responseXML){
                    reject('Response is not XML: ' + req.responseText);
                    return;
                }


                let doc = req.responseXML;
                let boards = [];

                let threads = doc.getElementsByTagName('item');

                Array.from(threads).forEach(thread => {
                    let threadTitle = thread.querySelector('title').textContent.replace(/\s*\((\d+)\)$/, '');
                    let threadPosts = RegExp.$1;
                    let threadURL = thread.querySelector('guid').textContent.replace(/\d+-\d+$/, '');
                    let boardTitle = thread.querySelector('category').textContent;
                    let pubDate = thread.querySelector('pubDate').textContent;

                    let options = { year: 'numeric', month: '2-digit', day: '2-digit',
                                    hour: '2-digit', minute: '2-digit', second: '2-digit' };
                    let infoText = '作成日時: ' + new Date(pubDate).toLocaleString('ja-JP', options);

                    let board = boards.find(board => board.title === boardTitle);

                    if(!board){
                        board = {
                            title: boardTitle,
                            threads: []
                        };

                        boards.push(board);
                    }

                    board.threads.push({
                        url: threadURL,
                        title: threadTitle,
                        post: threadPosts,
                        info: infoText,
                    });
                });

                resolve(boards);
            }, false);

            req.open("GET", url, true);
            req.overrideMimeType('application/rss+xml; charset=utf-8');
            req.send(null);
        });
    }

};
