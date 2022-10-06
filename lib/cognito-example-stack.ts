import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { UserPoolDomain } from "aws-cdk-lib/aws-cognito";

export class CognitoExampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ユーザープール
    const userPool = new cognito.UserPool(this, "UserPool", {
      email: cognito.UserPoolEmail.withCognito(), // 検証コードメールをCognitoで送信(SESも使える)
      passwordPolicy: {}, // デフォルトのパスワードポリシーを使用 https://docs.aws.amazon.com/ja_jp/cognito/latest/developerguide/user-pool-settings-policies.html
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    // アプリクライアント
    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool,
      generateSecret: true,
      authFlows: {
        adminUserPassword: true,
      },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        callbackUrls: ["http://localhost:3000/api/signin/callback"],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
    });
    // ドメイン
    const domain = new UserPoolDomain(this, "Domain", {
      userPool,
      cognitoDomain: { domainPrefix: "" }, // 適当なプレフィックスを付ける
    });
    // 保護対象リソースのLambda
    const lambdaFunction = new lambdaNodejs.NodejsFunction(this, "Function", {
      handler: "handler",
      entry: "src/app.ts",
    });
    // ↑のロググループ
    new logs.LogGroup(this, "LogGroup", {
      logGroupName: `/aws/lambda/${lambdaFunction.functionName}`,
    });
    // 保護対象リソースのAPI Gateway
    const api = new apigateway.RestApi(this, "Api", {
      defaultCorsPreflightOptions: {
        allowOrigins: ["http://localhost:3000"],
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
        statusCode: 200,
      },
    });
    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      "Authorizer",
      {
        cognitoUserPools: [userPool],
      }
    );
    const testPath = api.root.addResource("test");
    const integration = new apigateway.LambdaIntegration(lambdaFunction);
    testPath.addMethod("GET", integration, { authorizer });
    // セッション管理用テーブル
    const sessionsTable = new dynamodb.Table(this, "SessionsTable", {
      partitionKey: {
        name: "id",
        type: dynamodb.AttributeType.STRING,
      },
      tableName: "cognito-example-sessions-table",
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new cdk.CfnOutput(this, "ApiEndpoint", {
      exportName: "cognito-example-api-endpoint",
      value: api.url,
    });
    new cdk.CfnOutput(this, "UserPoolId", {
      exportName: "cognito-example-user-pool-id",
      value: userPool.userPoolId,
    });
    new cdk.CfnOutput(this, "UserPoolClientId", {
      exportName: "cognito-example-user-pool-client-id",
      value: userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, "CustomDomain", {
      exportName: "cognito-example-custom-domain",
      value: domain.domainName,
    });
    new cdk.CfnOutput(this, "SessionsTableName", {
      exportName: "cognito-example-sessions-table-name",
      value: sessionsTable.tableName,
    });
  }
}
