const { createClient } = require('@supabase/supabase-js');

// ローカル実行時のみ.envファイルを読み込み（GitHub Actions実行時は回避）
if (!process.env.GITHUB_ACTIONS && process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch (error) {
    console.log('📝 dotenvは使用できませんが、環境変数は直接設定されています');
  }
}

// 環境変数
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = 'Kubbo0308';
const REPO_NAME = 'Kubbo0308';

// Supabaseクライアント初期化
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchLatestPosts() {
  try {
    console.log('🔍 Kuboyageから最新記事を取得中...');
    
    const { data: posts, error } = await supabase
      .from('posts')
      .select('title, slug, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(4);

    if (error) {
      throw new Error(`Supabaseエラー: ${error.message}`);
    }

    if (!posts || posts.length === 0) {
      console.log('⚠️  公開済み記事が見つかりませんでした');
      return [];
    }

    console.log(`✅ ${posts.length}件の記事を取得しました`);
    return posts.map(post => ({
      title: post.title,
      url: `https://kuboyage.dev/blog/${post.slug}`,
      publishedAt: post.published_at
    }));

  } catch (error) {
    console.error('❌ 記事取得エラー:', error.message);
    throw error;
  }
}

async function updateReadme(posts) {
  try {
    console.log('📄 GitHub READMEを取得中...');
    
    // dynamic importでOctokitを読み込み
    const { Octokit } = await import('@octokit/rest');
    const octokit = new Octokit({
      auth: GITHUB_TOKEN,
    });
    
    // 現在のREADMEを取得
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner: GITHUB_USERNAME,
      repo: REPO_NAME,
      path: 'README.md',
    });

    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
    
    // MyBlog部分の開始と終了マーカー
    const startMarker = '### MyBlog🩵';
    const endMarker = '### Qiita🟢';
    
    const startIndex = currentContent.indexOf(startMarker);
    const endIndex = currentContent.indexOf(endMarker);
    
    if (startIndex === -1 || endIndex === -1) {
      throw new Error('READMEのMyBlogセクションが見つかりません');
    }

    // 新しい記事リストを生成
    const blogList = posts.map(post => 
      `- [${post.title}](${post.url})`
    ).join('\n');

    // README更新
    const beforeMyBlog = currentContent.substring(0, startIndex);
    const afterQiita = currentContent.substring(endIndex);
    
    const newContent = `${beforeMyBlog}${startMarker}
${blogList}

${afterQiita}`;

    // READMEを更新
    console.log('📝 READMEを更新中...');
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: GITHUB_USERNAME,
      repo: REPO_NAME,
      path: 'README.md',
      message: '🤖 Update MyBlog articles from Kuboyage',
      content: Buffer.from(newContent).toString('base64'),
      sha: fileData.sha,
    });

    console.log('✅ README更新完了！');

  } catch (error) {
    console.error('❌ README更新エラー:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Kuboyage記事の自動更新開始');
    console.log('==========================================');
    
    // 環境変数チェック
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !GITHUB_TOKEN) {
      throw new Error('必要な環境変数が設定されていません');
    }

    // 最新記事を取得
    const posts = await fetchLatestPosts();
    
    if (posts.length === 0) {
      console.log('⚠️  更新する記事がありません');
      return;
    }

    // README更新
    await updateReadme(posts);
    
    console.log('==========================================');
    console.log('🎉 すべて完了しました！');

  } catch (error) {
    console.error('💥 処理中にエラーが発生しました:', error.message);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  main();
}

module.exports = { fetchLatestPosts, updateReadme }; 