provider "aws" {
  access_key = var.aws_access_key
  secret_key = var.aws_secret_key
  region     = var.aws_region
}


data "aws_vpc" "main" {
  id = "vpc-0818c60a929eb299a"
}

resource "aws_subnet" "subnet_1" {
  vpc_id     = data.aws_vpc.main.id
  cidr_block = "172.31.48.0/20"
  availability_zone = "us-east-2a"
}

resource "aws_subnet" "subnet_2" {
  vpc_id     = data.aws_vpc.main.id
  cidr_block = "172.31.64.0/20"
  availability_zone = "us-east-2b"
}

resource "aws_subnet" "subnet_3" {
  vpc_id     = data.aws_vpc.main.id
  cidr_block = "172.31.80.0/20"
  availability_zone = "us-east-2c"
}

resource "aws_security_group" "lb_sg" {
  name        = "management-app-lb-sg"
  description = "Allow inbound traffic to ALB"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}



resource "aws_lb" "app_lb" {
  name               = "management-app-app-lb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.lb_sg.id]
  subnets            = [aws_subnet.subnet_1.id, aws_subnet.subnet_2.id, aws_subnet.subnet_3.id]
  enable_deletion_protection = false
  enable_cross_zone_load_balancing = true
}

resource "aws_lb_target_group" "ecs_target_group" {
  name     = "ecs-target-group"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = data.aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/health"
    interval            = 60
    timeout             = 30
    healthy_threshold   = 5
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.app_lb.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = var.acm_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ecs_target_group.arn
  }
}

resource "aws_security_group" "aurora_sg" {
  name        = "aurora-sg"
  description = "Allow ECS to connect to Aurora"
  vpc_id      = data.aws_vpc.main.id
}

resource "aws_security_group_rule" "aurora_ingress" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.aurora_sg.id
  source_security_group_id = aws_security_group.ecs_sg.id
}

resource "aws_security_group_rule" "ecs_allow_outbound_db" {
  type              = "egress"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  security_group_id = aws_security_group.ecs_sg.id
  cidr_blocks       = [data.aws_vpc.main.cidr_block]
}

resource "aws_security_group" "ecs_sg" {
  name        = "management-app-ecs-sg"
  description = "Allow inbound traffic from ALB to ECS Tasks"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    security_groups = [aws_security_group.lb_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_iam_role" "ecs_task_execution_role" {
  name = "ecsTaskExecutionRole"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Effect    = "Allow"
      Sid       = ""
    }]
  })
}

resource "aws_iam_role" "ecs_task_role" {
  name = "ecsTaskRole"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Effect    = "Allow"
      Sid       = ""
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_policy" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
  role       = aws_iam_role.ecs_task_execution_role.name
}

resource "aws_iam_role_policy" "ecs_task_policy" {
  name   = "ecs-task-policy"
  role   = aws_iam_role.ecs_task_role.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = "ecr:BatchGetImage"
        Resource = "arn:aws:ecr:us-east-2:123456789101:repository/management-app/node"
      }
    ]
  })
}

resource "aws_ecs_cluster" "management-app_node_cluster" {
  name = "management-app-node-cluster"
}

resource "aws_ecs_task_definition" "management-app_task_def" {
  family                   = "management-app-task"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn
  network_mode             = "awsvpc"
  cpu                      = "1024"
  memory                   = "2048"
  container_definitions    = jsonencode([{
    name      = "management-app-node"
    image     = "123456789101.dkr.ecr.us-east-2.amazonaws.com/management-app/node:latest"
    essential = true
    portMappings = [{
      containerPort = 3000
      protocol      = "tcp"
    }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/management-app-task"
        "awslogs-region"        = "us-east-2"
        "awslogs-stream-prefix" = "management-app-node"
      }
    }
  }])
}

resource "aws_ecs_service" "ecs_service" {
  name            = "management-app-node-ecs-service"
  cluster         = aws_ecs_cluster.management-app_node_cluster.id
  task_definition = aws_ecs_task_definition.management-app_task_def.arn
  desired_count   = 1
  launch_type     = "FARGATE"
  enable_execute_command = true


  network_configuration {
    subnets          = [aws_subnet.subnet_1.id, aws_subnet.subnet_2.id, aws_subnet.subnet_3.id]
    security_groups  = [aws_security_group.ecs_sg.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.ecs_target_group.arn
    container_name   = "management-app-node"
    container_port   = 3000
  }
}

resource "aws_appautoscaling_target" "ecs_scaling_target" {
  max_capacity       = 3
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.management-app_node_cluster.name}/${aws_ecs_service.ecs_service.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "ecs_scaling_policy" {
  name               = "ecs-cpu-scaling-policy"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_scaling_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_scaling_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_scaling_target.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 70
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    scale_in_cooldown  = 60
    scale_out_cooldown = 60
  }
}

output "alb_dns_name" {
  value = aws_lb.app_lb.dns_name
}


