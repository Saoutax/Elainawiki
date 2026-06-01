'use strict';
$(() => {
    const body = document.body;
    const bottomRightCorner = $('<div>').attr('id', 'bottomRightCorner');
    bottomRightCorner.appendTo(body);
    window.insertToBottomRightCorner = (text: string) =>
        $('<div>').text(text).appendTo(bottomRightCorner);

    let $target: JQuery<HTMLElement> | undefined;
    if (mw.config.get('skin') === 'vector-2022') {
        $target = $('body > .mw-page-container');
    }
    if ($target && $target.length > 0) {
        let nextAnimationFrameTriggered = false;
        $(window)
            .on('resize', () => {
                if (nextAnimationFrameTriggered) {
                    return;
                }
                nextAnimationFrameTriggered = true;
                requestAnimationFrame(() => {
                    const targetOuterWidth = $target.outerWidth();
                    if (typeof targetOuterWidth !== 'number') {
                        return;
                    }
                    const windowWidth = $(window).width();
                    if (typeof windowWidth !== 'number') {
                        return;
                    }
                    const right = Math.max((windowWidth - targetOuterWidth) / 2 - 20, 20);
                    bottomRightCorner.css('right', `${right}px`);
                    nextAnimationFrameTriggered = false;
                });
            })
            .trigger('resize');
    }
});
