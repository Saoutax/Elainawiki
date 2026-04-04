import { Mwn } from 'mwn';
import { contentHash, needDeploy } from './utils';
import 'dotenv/config';

const deploy = async () => {
    const bot = new Mwn({
        apiUrl: 'https://elaina.miraheze.org/w/api.php',
        userAgent: `${process.env['USERAGENT']} (Github Actions; Saoutax-bot)`,
        username: 'MisakaNetwork@MisakaNetwork',
        password: process.env['PASSWORD']!,
        maxRetries: 20,
    });

    const oldDeploymentJson = async (): Promise<Record<string, string> | Record<string, never>> => {
        const data = await bot.read('MediaWiki:Deployment.json', {
            rvprop: ['content'],
        });
        const content = 'missing' in data ? '' : (data.revisions?.[0]?.content ?? '');
        return content ? JSON.parse(content) : {};
    };

    const oldDeploy = await oldDeploymentJson(),
        currentDeploy = await contentHash(),
        deployment = needDeploy(oldDeploy, currentDeploy);
    await bot.batchOperation(Object.entries(deployment), async ([title, content]) =>
        bot.save(title, content, 'Git commit', { bot: true, tags: 'Bot' }),
    );
    await bot.save(
        'MediaWiki:Deployment.json',
        JSON.stringify(
            Object.fromEntries(Object.entries(currentDeploy).map(([key, { hash }]) => [key, hash])),
        ),
        'Update deployment status',
        {
            bot: true,
            tags: 'Bot',
        },
    );
};

export { deploy };
