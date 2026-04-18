(() => {
    if (mw.config.get('wgAction') === 'history') {
        mw.loader.load('//fastly.jsdelivr.net/gh/Saoutax/MWGadgets@main/dist/QuickUndo.min.js');
    }
})();
