import { Configuration, EnvironmentPlugin } from 'webpack';
// tslint:disable-next-line no-require-imports
import HtmlWebpackPlugin = require('html-webpack-plugin');
import { resolve } from 'path';

const context = __dirname;
const { NODE_ENV: mode = 'development' } = process.env;
const isDev = mode === 'development';

const csp = `
  default-src 'none';
  child-src 'self';
  connect-src 'self'${isDev ? ' http: ws:' : ''};
  font-src 'self';
  form-action 'self';
  frame-src 'none';
  img-src 'self' blob: data:;
  media-src 'self' blob:;
  object-src 'none';
  script-src 'self'${isDev ? " 'unsafe-eval'" : ''};
  style-src 'self' 'unsafe-inline';
`;

const stickerCreatorConfig: Configuration = {
  context,
  mode: mode as Configuration['mode'],
  devtool: 'source-map',
  entry: [
    'react-hot-loader/patch',
    'sanitize.css',
    'typeface-inter',
    './sticker-creator/index.tsx',
  ],
  output: {
    path: resolve(context, 'sticker-creator/dist'),
    filename: 'bundle.js',
    publicPath: mode === 'production' ? './' : '/sticker-creator/dist/',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'babel-loader',
      },
      {
        test: /\.css$/,
        loaders: ['style-loader', 'css-loader'],
      },
      {
        test: /\.scss$/,
        loaders: [
          'style-loader',
          'css-loader?modules=true&localsConvention=camelCaseOnly',
          'sass-loader',
        ],
      },
      {
        test: /\.woff2?$/,
        loader: 'file-loader',
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
    alias: {},
  },
  plugins: [
    new EnvironmentPlugin(['NODE_ENV']),
    new HtmlWebpackPlugin({
      title: 'Signal Sticker Creator',
      template: resolve(context, 'sticker-creator/index.html'),
      meta: {
        'Content-Security-Policy': {
          'http-equiv': 'Content-Security-Policy',
          content: csp,
        },
      },
    }),
  ],
  // @ts-ignore: this typing broke at some point
  devServer: {
    port: 6380,
    historyApiFallback: {
      rewrites: [{ from: /./, to: '/sticker-creator/dist/index.html' }],
    },
  },
};

// tslint:disable-next-line no-default-export
export default [stickerCreatorConfig];
