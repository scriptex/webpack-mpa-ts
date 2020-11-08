import { exec } from 'child_process';
import { parse } from 'url';
import { resolve } from 'path';
import { readdirSync } from 'fs';

import { argv } from 'yargs';
import * as webpack from 'webpack';
import * as magicImporter from 'node-sass-magic-importer';
import * as SpritesmithPlugin from 'webpack-spritesmith';
import * as BrowserSyncPlugin from 'browser-sync-webpack-plugin';
import * as WebpackShellPlugin from 'webpack-shell-plugin';
import * as CleanWebpackPlugin from 'clean-webpack-plugin';
import * as MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { Options as SVGOOptions } from 'svgo';
import { Options as BrowsersyncOptions } from 'browser-sync';

import * as cssnano from 'cssnano';
import * as postcssURL from 'postcss-url';
import * as autoprefixer from 'autoprefixer';
import * as postcssUtilities from 'postcss-utilities';
import * as postcssEasyImport from 'postcss-easy-import';
import * as postcssMergeRules from 'postcss-merge-rules';
import * as postcssWatchFolder from 'postcss-watch-folder';
import * as postcssFlexbugsFixed from 'postcss-flexbugs-fixes';

interface ISourceMap {
	sourceMap: boolean;
}

interface IObjectsArray {
	plugins: any;
	sourceMap?: boolean;
}

const { url, server, NODE_ENV }: any = argv;
const sourceMap: ISourceMap = {
	sourceMap: NODE_ENV === 'development'
};

if (server) {
	exec('php index.php > index.html');
}

const svgoConfig: SVGOOptions = {
	plugins: [
		{ cleanupAttrs: true },
		{ removeDoctype: true },
		{ removeXMLProcInst: true },
		{ removeComments: true },
		{ removeMetadata: true },
		{ removeUselessDefs: true },
		{ removeEditorsNSData: true },
		{ removeEmptyAttrs: true },
		{ removeHiddenElems: false },
		{ removeEmptyText: true },
		{ removeEmptyContainers: true },
		{ cleanupEnableBackground: true },
		{ removeViewBox: false },
		{ cleanupIDs: false },
		{ convertStyleToAttrs: true },
		{ removeUselessStrokeAndFill: true }
	]
};

const postcssOptions: IObjectsArray = {
	plugins: [postcssURL({ url: 'rebase' }), autoprefixer(), postcssUtilities, postcssEasyImport, postcssFlexbugsFixed],
	...sourceMap
};

const browserSyncConfig: BrowsersyncOptions = {
	host: 'localhost',
	port: 3000,
	open: 'external',
	/* eslint-disable no-mixed-spaces-and-tabs */
	files: [
		server
			? {
					match: ['*.php'],
					fn(_: any, file: string): void {
						const name = file.replace(/.php$/, '');

						exec(`php ${file} > ${name}.html`);
					}
			  }
			: '**/*.php',
		'**/*.html',
		'./assets/dist/app.css',
		'./assets/dist/app.js'
	],
	/* eslint-enable */
	ghostMode: {
		clicks: false,
		scroll: true,
		forms: {
			submit: true,
			inputs: true,
			toggles: true
		}
	},
	snippetOptions: {
		rule: {
			match: /<\/body>/i,
			fn: (snippet, match) => `${snippet}${match}`
		}
	},
	proxy: 'localhost'
};

const extractTextConfig: MiniCssExtractPlugin.PluginOptions = {
	filename: 'dist/app.css'
};

const spritesmithConfig = {
	src: {
		cwd: resolve(__dirname, 'assets/images/sprite'),
		glob: '*.png'
	},
	target: {
		image: resolve(__dirname, './assets/dist/sprite.png'),
		css: resolve(__dirname, './assets/styles/_sprite.scss')
	},
	apiOptions: {
		cssImageRef: '../dist/sprite.png'
	},
	retina: '@2x'
};

const cleanConfig: Record<string, any> = {
	verbose: false,
	exclude: ['sprite.svg'],
	allowExternal: true
};

const shellScripts: string[] = [];
const svgs: string[] = readdirSync('./assets/images/svg').filter(svg => svg[0] !== '.');

if (svgs.length) {
	shellScripts.push('svgo -f assets/images/svg --config=' + JSON.stringify(svgoConfig));

	shellScripts.push('spritesh -q -i assets/images/svg -o ./assets/dist/sprite.svg -p svg-');
}

module.exports = (): webpack.Configuration => {
	const isDevelopment: boolean = NODE_ENV === 'development';
	const isProduction: boolean = NODE_ENV === 'production';

	if (isProduction) {
		postcssOptions.plugins.push(postcssMergeRules, cssnano());
	}

	if (isDevelopment) {
		postcssOptions.plugins.push(
			postcssWatchFolder({
				folder: './assets/styles',
				main: './assets/styles/main.scss'
			})
		);
	}

	const config: webpack.Configuration = {
		mode: NODE_ENV,
		entry: ['./assets/styles/main.scss', './assets/scripts/main.ts'],
		output: {
			path: resolve(__dirname, './assets'),
			filename: 'dist/app.js'
		},
		resolve: {
			modules: ['node_modules', './assets/scripts', './assets/images/sprite'],
			extensions: ['.js', '.ts']
		},
		module: {
			rules: [
				{
					test: /\.(sa|sc|c)ss$/,
					use: [
						{
							loader: MiniCssExtractPlugin.loader
						},
						{
							loader: 'css-loader',
							options: sourceMap
						},
						{
							loader: 'postcss-loader',
							options: { postcssOptions }
						},
						{
							loader: 'sass-loader',
							options: {
								sassOptions: {
									importer: magicImporter()
								},
								...sourceMap
							}
						}
					]
				},
				{
					test: /\.ts$/,
					loader: 'awesome-typescript-loader'
				},
				{
					test: /\.js/,
					loader: 'source-map-loader'
				},
				{
					test: /\.(jpe?g|gif|png|svg|woff2?|ttf|eot|wav|mp3|mp4)(\?.*$|$)/,
					use: [
						{
							loader: 'file-loader',
							options: {
								name: '[hash].[ext]',
								context: '',
								publicPath: './',
								outputPath: './dist/'
							}
						}
					]
				}
			]
		},
		plugins: [
			new webpack.ProvidePlugin({
				$: 'jquery',
				jQuery: 'jquery',
				'window.jQuery': 'jquery'
			}),
			new MiniCssExtractPlugin(extractTextConfig),
			new SpritesmithPlugin(spritesmithConfig),
			new CleanWebpackPlugin(['../assets/dist/'], cleanConfig),
			new WebpackShellPlugin({
				onBuildStart: shellScripts
			})
		],
		externals: {
			jquery: 'jQuery'
		},
		cache: true,
		bail: false,
		devtool: isDevelopment ? 'source-map' : false,
		stats: 'errors-only'
	};

	if (isDevelopment) {
		if (url) {
			browserSyncConfig.host = parse(url).hostname;
			browserSyncConfig.proxy = url;
		}

		if (server) {
			delete browserSyncConfig.host;
			delete browserSyncConfig.proxy;

			browserSyncConfig.server = true;
		}

		config.plugins.push(
			new BrowserSyncPlugin(browserSyncConfig, {
				reload: false
			})
		);
	}

	return config;
};
