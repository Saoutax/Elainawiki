(async () => {
    if (mw.config.get('wgIsArticle') && mw.config.get('wgAction') === 'view') {
        mw.loader.load('//testingcf.jsdelivr.net/npm/wikiplus-highlight@latest');
    }
})();
