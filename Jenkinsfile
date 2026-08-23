pipeline {
  agent { label 'onehealth-node20' }

  parameters {
    booleanParam(
      name: 'DEPLOY_PRODUCTION',
      defaultValue: false,
      description: 'Déployer main après réussite de tous les contrôles'
    )
  }

  options {
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
    timestamps()
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        sh 'node --version && npm --version'
      }
    }

    stage('Dependencies') {
      steps {
        sh 'npm ci'
      }
    }

    stage('Quality gate') {
      steps {
        sh 'npm run lint'
        sh 'npm run build'
        sh 'npm test -- --runInBand'
        sh 'npm run test:e2e -- --runInBand'
        sh 'npm run verify:pm2-config'
        sh 'npm audit --audit-level=high'
        sh '''
          if find dist -print | grep -E '/(\.specify|\.agents|specs|project-docs)(/|$)'; then
            echo 'Engineering documents must not be present in dist.'
            exit 1
          fi
        '''
      }
    }

    stage('Deploy production') {
      when {
        allOf {
          expression { params.DEPLOY_PRODUCTION }
          expression {
            env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main'
          }
        }
      }
      steps {
        sh 'sudo -n -u yabain /usr/local/sbin/deploy-onehealth-backend'
      }
    }
  }

  post {
    always {
      deleteDir()
    }
  }
}
