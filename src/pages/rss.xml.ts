import rss from '@astrojs/rss';
import {getCollection} from 'astro:content';
import type {APIRoute} from 'astro';
import {SITE_URL} from '@/lib/site';
import {t} from '@/i18n/ui';

export const GET: APIRoute = async () => {
  const posts = (await getCollection('blog', ({data}) => !data.draft)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
  );

  return rss({
    title: t('id', 'Meta', 'title'),
    description: t('id', 'Meta', 'description'),
    site: SITE_URL,
    items: posts.map((post) => {
      const [locale, ...rest] = post.id.split('/');
      return {
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.date,
        link: `/${locale}/blog/${rest.join('/')}`
      };
    }),
    customData: '<language>id</language>'
  });
};
