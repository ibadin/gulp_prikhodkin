"use strict"

import gulp from "gulp";
import ghPages from "gh-pages";
import requireDir from "require-dir";
import path from "path";
import libs from "./libs";
import config from "./lighthouse.config";
import fsN from 'fs';
import open from "open";
import serverN from 'browser-sync';
import del from "del";
import lighthouseN from "lighthouse";
import { write } from "lighthouse/lighthouse-cli/printer";
import reportGenerator from "lighthouse/lighthouse-core/report/report-generator";


const chromeLauncher = require('chrome-launcher');
const fs = fsN.promises;
const server = serverN.create();

// Пути для тасков
const paths = {
    html: {
      src: "src/pages/**/*.html",
      dest: "./dist/",
      watch: "src/**/*.html"
    },
    clean: {
      src: "./dist/*"
    },
    favicons: {
      src: "./src/img/favicons/*.{jpg,jpeg,png,gif}",
      dest: "./dist/img/favicons/"
    },
    fonts: {
      src: "./src/fonts/**/*.{woff,woff2}",
      dest: "./dist/fonts/",
      watch: "src/fonts/**/*"
    },
    images: {
      src: ["./src/img/**/*.{jpg,jpeg,png,gif,svg,mp4}", "!./src/img/svg/icons/*", "!./src/img/favicons/*.{jpg,jpeg,png,gif,svg}"],
      dest: "./dist/img/",
      watch: "src/img/**/*"
    },
    sass: {
      src: ["src/scss/main.scss", "src/pages/**/*.scss"],
      dest: "dist/css/",
      watch: ["src/scss/**/*.scss","src/blocks/**/*.scss", "src/pages/**/*.scss"]
    },
    scripts: {
      src: ["src/js/**/*.js","src/pages/**/*.js"],
      dest: "./dist/js/",
      watch: ["src/js/**/*.js", "src/blocks/**/*.js", "src/pages/**/*.js"]
    },
    scriptsLib: {
      src: libs,
      dest: "./dist/js/"
    },
    sprite: {
      src: "./src/img/icons/svg/*.svg",
      dest: "./dist/img/sprites/",
      style: "../../../src/scss/blocks/_sprite.scss",
      svg: "../../../dist/img/sprites/sprite.svg",
      watch: "src/img/icons/svg/*"
    },
    webp: {
      src: ["./src/img/**/*.{jpg,jpeg,png,gif}", "!./src/img/svg/icons/*", "!./src/img/favicons/*.{jpg,jpeg,png,gif,svg}"],
      dest: "./dist/img/",
      watch: "src/img/**/*"
    }
  };

requireDir("./gulp/tasks/");

export { paths };

gulp.task('dev',
  gulp.series('clean',
    gulp.parallel('sprite','sass','html','scripts:lib','scripts','images','favicons','fonts', 'webp'),
    gulp.parallel('watch','serve')
  ));

gulp.task('build',
  gulp.series('clean',
    gulp.parallel('sprite','sass:min','html:min','scripts:min','scripts-lib:min','images:min','favicons','fonts', 'webp'),
    'hash'
  ));

// Деплой на GH-Pages
export const deploy = (cb) => {
  ghPages.publish(path.join(process.cwd(), './dist'), cb);
}

// Тест LightHouse

// Получение html файлов
async function getNameHTMLFiles() {
  const files = await fs.readdir(config.buildPath)
  return files.filter(item => item.endsWith('.html'))
}

// Запуск сервера
function startServer() {
  return server.init({
    server: config.buildPath,
    port: config.lighthouse.PORT,
    notify: false,
    open: false,
    cors: true
  })
}

//Открытие хрома и запуск проверки
async function launchChromeAndRunLighthouse(url) {
  const chrome = await chromeLauncher.launch()
  config.lighthouse.chromeLauncherPort = chrome.port

  const result = await lighthouseN(url, {
    ...config.lighthouse.flags,
    port: config.lighthouse.chromeLauncherPort
  }, config.lighthouse.config)
  await chrome.kill()

  return result
}

//Запуск проверки
async function runLighthouse(fileName) {
  console.log(fileName)
  const result = await launchChromeAndRunLighthouse(`http://localhost:${config.lighthouse.PORT}/${fileName}`)
  await write(reportGenerator.generateReportHtml(result.lhr), 'html', path.join(config.lighthouse.reportPath, fileName))
}

//Таск для галпа
async function lighthouse(cb) {
  await del(config.lighthouse.reportPath)
  await fs.mkdir(config.lighthouse.reportPath)

  startServer()
  const files = await getNameHTMLFiles()

  try {
    for (const file of files) {
      await runLighthouse(file)
    }

    for (const file of files) {
      await open(path.join(config.lighthouse.reportPath, file))
    }
    cb()
    process.exit(0) //browser-sync API server.exit() do not work
  } catch (e) {
    cb(e.message)
    process.exit(1) //browser-sync API server.exit() do not work
  }
}

exports.lighthouse = lighthouse;
