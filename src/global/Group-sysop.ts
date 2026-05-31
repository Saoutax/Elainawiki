$(() => {
    const { wgCanonicalSpecialPageName } = mw.config.get(['wgCanonicalSpecialPageName']);

    // 默认导入理由
    if (wgCanonicalSpecialPageName === 'Import') {
        $('#mw-input-usernamePrefix input').val('zhmoe');
        $('#mw-input-log-comment input').val(
            '来源于萌娘百科，依CC BY-NC-SA 3.0 CN导入，原贡献者请参见来源页面历史',
        );
    }

    // Special:ReplaceText
    if (wgCanonicalSpecialPageName === 'ReplaceText' && $('#powersearch')[0]) {
        $('input[name="botEdit"]').prop('checked', true);
        $('input[name="ns10"]').prop('checked', true);
    }

    // Special:MassEditRegex
    if (wgCanonicalSpecialPageName === 'MassEditRegex') {
        $('#wpSummaryLabel').text('摘要：');
        document.querySelector('thead')?.removeAttribute('class');
    }
});
