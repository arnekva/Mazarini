module.exports = {
    apps: [
        {
            name: 'mazarini',
            script: 'bin/bundle.js',
            interpreter: 'node',
            watch: false,
            ignore_watch: ['node_modules', 'res/ccg/generated', '.git'],
        },
    ],
}
