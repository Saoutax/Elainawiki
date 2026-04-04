import { transformFile } from '@swc/core';
import { transform } from 'lightningcss';
import { resolve, relative, dirname, basename, extname } from 'node:path';
import { rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import FastGlob from 'fast-glob';
import { generateDefinition } from './definition';

const SRC_DIR = resolve('src');
const DIST_DIR = resolve('dist');

type FileProcessor = (file: string) => Promise<Uint8Array | string>;

const transpileJs: FileProcessor = async file => {
    const { code } = await transformFile(file);
    return code;
};

const transpileCss: FileProcessor = async file => {
    const source = await readFile(file);
    const { code } = transform({
        filename: file,
        code: Buffer.from(source),
        minify: false,
        sourceMap: false,
    });
    return code;
};

const processFiles = async (
    pattern: string,
    subDir: string,
    processor: FileProcessor,
    filter?: (file: string) => boolean,
) => {
    const files = await FastGlob(pattern, { cwd: SRC_DIR, absolute: true });

    await Promise.all(
        files
            .filter(file => !filter || filter(file))
            .map(async file => {
                const relPath = relative(resolve(SRC_DIR, subDir), file);
                const outFile = resolve(DIST_DIR, subDir, relPath);
                const code = await processor(file);
                await mkdir(dirname(outFile), { recursive: true });
                await writeFile(outFile, code);
            }),
    );
};

const isGadgetEntryFile = (file: string) => {
    const relPath = relative(resolve(SRC_DIR, 'gadgets'), file);
    const dir = basename(dirname(relPath));
    return basename(relPath) === `Gadget-${dir}${extname(relPath)}`;
};

const build = async () => {
    await rm(DIST_DIR, { recursive: true, force: true });
    await mkdir(resolve(DIST_DIR, 'gadgets'), { recursive: true });

    await writeFile(`${DIST_DIR}/gadgets/Gadgets-definition`, await generateDefinition());

    await Promise.all([
        processFiles('gadgets/*/*.js', 'gadgets', transpileJs, isGadgetEntryFile),
        processFiles('gadgets/*/*.css', 'gadgets', transpileCss, isGadgetEntryFile),
        processFiles('global/*.js', 'global', transpileJs),
        processFiles('global/*.css', 'global', transpileCss),
    ]);
};

export { build };
