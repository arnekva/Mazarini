module.exports = {
    apps: [
        {
            name: 'mazarini',
            script: 'index.ts',
            watch: true,
            ignore_watch: ['node_modules', 'res/ccg/generated', '.git'],
        },
    ],
}
