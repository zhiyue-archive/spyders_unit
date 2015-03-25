var node = {
    async: require('async'),
    cheerio: require('cheerio'),
    fs: require('fs'),
    mkdirp: require('mkdirp'),
    path: require('path'),
    request: require('request'),
    url: require('url'),
    xml2js: require('xml2js'),
};
 
var Me2SexImages = {
 
    /**
     * 配置选项
     */
    options: {
        // 网站sitemap地址
        sitemap: 'http://sexy.faceks.com/sitemap.xml',
        // 保存到此文件夹
        saveTo: '/Users/Fay/Pictures/me2sex',
        // 图片并行下载上限
        downLimit: 5,
    },
 
    posts: [],
 
    /**
     * 开始下载（程序入口函数）
     */
    start: function() {
        var self = this;
        var async = node.async;
 
        async.waterfall([
            self.wrapTask(self.sitemapXML),
            self.wrapTask(self.sitemapJSON),
            self.wrapTask(self.downAllImages),
        ], function(err, result) {
            if (err) {
                console.log('error: %s', err.message);
            } else {
                console.log('success: 下载成功');
            }
        });
    },
 
    /**
     * 包裹任务，确保原任务的上下文指向某个特定对象
     * @param  {Function} task 符合asycs.js调用方式的任务函数
     * @param  {Any} context 上下文
     * @param  {Array} exArgs 额外的参数
     * @return {Function} 符合asycs.js调用方式的任务函数
     */
    wrapTask: function(task, context, exArgs) {
        var self = this;
        return function() {
            var args = [].slice.call(arguments);
            args = exArgs ? exArgs.concat(args) : args;
            task.apply(context || self, args);
        };
    },
 
    /**
     * 获取站点sitemap.xml
     */
    sitemapXML: function(callback) {
        console.log('开始下载sitemap.xml');
        node.request(this.options.sitemap, function(err, res, body) {
            if (!err) console.log('下载sitemap.xml成功');
            callback(err, body);
        });
    },
 
    /**
     * 将sitemap.xml转成json
     */
    sitemapJSON: function(sitemapXML, callback) {
        var self = this;
        console.log('开始解析sitemap.xml');
        node.xml2js.parseString(sitemapXML, {explicitArray: false}, function(err, json) {
            if (!err) {
                self.posts = json.urlset.url;
                self.posts.shift();
                console.log('解析sitemap.xml成功，共有%d个页面', self.posts.length);
            }
            callback(err, self.posts);
        });
    },
 
 
 
    /**
     * 下载整站图片
     */
    downAllImages: function(callback) {
        var self = this;
        var async = node.async;
        console.log('开始批量下载');
        async.eachSeries(self.posts, self.wrapTask(self.downPostImages), callback);
    },
 
 
    /**
     * 下载单个post的图片
     * @param  {Object} post 文章
     */
    downPostImages: function(post, callback) {
        var self = this;
        var async = node.async;
 
        async.waterfall([
            self.wrapTask(self.mkdir, self, [post]),
            self.wrapTask(self.getPost),
            self.wrapTask(self.parsePost),
            self.wrapTask(self.downImages),
        ], callback);
    },
 
    mkdir: function(post, callback) {
        var path = node.path;
        var url = node.url.parse(post.loc);
        post.dir = path.join(this.options.saveTo, path.basename(url.pathname));
 
        console.log('准备创建目录：%s', post.dir);
        if (node.fs.existsSync(post.dir)) {
            callback(null, post);
            console.log('目录：%s 已经存在', post.dir);
            return;
        }
        node.mkdirp(post.dir, function(err) {
            callback(err, post);
            console.log('目录：%s 创建成功', post.dir);
        });
    },
 
    /**
     * 获取post内容
     */
    getPost: function(post, callback) {
        console.log('开始请求页面：%s', post.loc);
        node.request(post.loc, function(err, res, body) {
            if (!err) post.html = body;
            callback(err, post);
            console.log('请求页面成功：%s', post.loc);
        });
    },
 
    /**
     * 解析post，并获取post中的图片列表
     */
    parsePost: function(post, callback) {
        var $ = post.$ = node.cheerio.load(post.html);
        post.images = $('.img')
            .map(function() {return $(this).attr('bigimgsrc');})
            .toArray();
        callback(null, post);
    },
 
    /**
     * 下载post图片列表中的图片
     */
    downImages: function(post, callback) {
        console.log('发现%d张妹子图片，准备开始下载...', post.images.length);
        node.async.eachLimit(
            post.images,
            this.options.downLimit,
            this.wrapTask(this.downImage, this, [post]),
            callback
        );
    },
 
    /**
     * 下载单个图片
     */
    downImage: function(post, imgsrc, callback) {
        var url = node.url.parse(imgsrc);
        var fileName = node.path.basename(url.pathname);
        var toPath = node.path.join(post.dir, fileName);
        console.log('开始下载图片：%s，保存到：%s，文件名：%s', imgsrc, post.dir, fileName);
        node.request(imgsrc)
            .pipe(node.fs.createWriteStream(toPath))
            .on('close', function() {
                console.log('图片下载成功：%s', imgsrc);
                callback();
            })
            .on('error', callback);
    }
};
 
Me2SexImages.start();