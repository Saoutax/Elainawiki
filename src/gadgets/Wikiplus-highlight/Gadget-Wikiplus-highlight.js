(async () => {
    const { wgIsArticle, wgAction } = mw.config.get(['wgIsArticle', 'wgAction']);
    if (wgIsArticle && wgAction === 'view') {
        mw.loader.load('//testingcf.jsdelivr.net/npm/wikiplus-highlight@latest');
    }
})();
