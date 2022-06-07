const gulp = require('gulp');
const babel = require('gulp-babel');
const sourceMap = require('gulp-sourcemaps');

const buildList = ['graphDB.js']

gulp.task('build', () => {
    gulp.src(buildList)
        .pipe(sourceMap.init())
        .pipe(babel())
        .pipe(sourceMap.write('.')
        .pipe(gulp.dest('build')))
})

gulp.task('default', ['build'])