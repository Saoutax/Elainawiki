declare global {
    interface Window {
        oouiDialog: {
            alert: (text: string | JQuery, options?: Partial<OouiDialogOptions>) => Promise<void>;
            confirm: (
                text: string | JQuery,
                options?: Partial<OouiDialogOptions>,
            ) => Promise<boolean>;
            prompt: (
                text: string | JQuery,
                options?: Partial<OouiDialogOptions>,
            ) => Promise<string | null>;
            sanitize: (text: string) => string;
        };
    }
}

interface OouiDialogOptions {
    title: string;
    size: string;
    allowFullscreen: boolean;
    textInput: Partial<OO.ui.TextInputWidget.ConfigOptions>;
    required: boolean;
}

(() => {
    let running = false;
    const resArray: Array<{ resolve: () => void }> = [];

    window.oouiDialog = Object.fromEntries(
        (['alert', 'confirm', 'prompt'] as const).map(method => [
            method,
            async (
                textORjquery: string | JQuery,
                _option?: Partial<OouiDialogOptions>,
            ): Promise<unknown> => {
                const { sizes } = OO.ui.WindowManager.static;
                const sizeNames = Object.keys(sizes)
                    .filter(s => typeof sizes[s]!.width === 'number')
                    .sort((a, b) => (sizes[a]!.width as number) - (sizes[b]!.width as number));
                const defaultSize = sizeNames[0]!;

                const option: Partial<OouiDialogOptions> = _option ?? {};

                const setup: {
                    size: string;
                    textInput?: OO.ui.TextInputWidget;
                } = {
                    size: defaultSize,
                };

                if (option.allowFullscreen !== true) {
                    const { rect } = OO.ui.Element.static.getDimensions(window);
                    const windowWidth = rect.right - rect.left;
                    const acceptableSize = sizeNames.filter(
                        s => (sizes[s]!.width as number) < windowWidth,
                    );
                    if (acceptableSize.length > 0) {
                        setup.size =
                            option.size && acceptableSize.includes(option.size)
                                ? option.size
                                : acceptableSize[acceptableSize.length - 1]!;
                    } else {
                        setup.size = defaultSize;
                    }
                } else {
                    setup.size = option.size && option.size in sizes ? option.size : defaultSize;
                }

                if (method === 'prompt') {
                    const config = {
                        autocomplete: false,
                        ...option.textInput,
                    };
                    setup.textInput = new OO.ui.TextInputWidget(config);
                    if (option.required) {
                        setup.textInput.setIndicator(config.indicator || 'required');
                        setup.textInput.setValidation(config.validate || 'non-empty');
                    }
                }

                await new Promise<void>(res => {
                    if (running) {
                        resArray.push({ resolve: res });
                    } else {
                        running = true;
                        res();
                    }
                });

                try {
                    let result: unknown;
                    while (Number.MAX_SAFE_INTEGER > Number.MIN_SAFE_INTEGER) {
                        result = await new Promise<unknown>((resolve, reject) => {
                            const fn = OO.ui[method as 'alert' | 'confirm' | 'prompt'] as (
                                text: string | JQuery,
                                options?: Record<string, unknown>,
                            ) => JQuery.Promise<unknown>;
                            fn(
                                textORjquery instanceof $
                                    ? textORjquery
                                    : $('<p>').html(textORjquery as string),
                                {
                                    title: '萌娘百科提醒您',
                                    ...option,
                                    ...setup,
                                },
                            )
                                .done(resolve)
                                .fail(reject);
                        });

                        try {
                            if (setup.textInput && result !== null) {
                                await setup.textInput.getValidity();
                            }
                            break;
                        } catch {
                            await OO.ui.alert(
                                $('<p>').html(
                                    '您没有在刚才的输入框内填写符合要求的信息，请重新填写！',
                                ),
                                {
                                    title: '未填写符合要求的信息',
                                },
                            );
                            continue;
                        }
                    }
                    return result;
                } finally {
                    if (resArray.length > 0) {
                        resArray.shift()!.resolve();
                    } else {
                        running = false;
                    }
                }
            },
        ]),
    ) as unknown as Window['oouiDialog'];

    const sanity = $('<span>');
    window.oouiDialog.sanitize = (text: string): string => sanity.text(text).html();
})();
