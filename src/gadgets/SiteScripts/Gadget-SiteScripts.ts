(() => {
    const { wgAction } = mw.config.get();

    // 快速填写编辑摘要
    if (wgAction === 'edit') {
        $('[for="wpSummary"] .mw-summary-preset-item a').on('click', (e) => {
            const summaryBox = $('[name="wpSummary"]');
            summaryBox.val(`${String(summaryBox.val())} ${$(e.currentTarget).text()}`.trim());
            summaryBox.trigger('focus');
            return false;
        });
    }
})();
